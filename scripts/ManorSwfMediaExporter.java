import com.jpexs.decompiler.flash.SWF;
import com.jpexs.decompiler.flash.exporters.commonshape.ExportRectangle;
import com.jpexs.decompiler.flash.exporters.commonshape.Matrix;
import com.jpexs.decompiler.flash.tags.DefineSoundTag;
import com.jpexs.decompiler.flash.tags.ExportAssetsTag;
import com.jpexs.decompiler.flash.tags.SymbolClassTag;
import com.jpexs.decompiler.flash.tags.Tag;
import com.jpexs.decompiler.flash.tags.base.CharacterTag;
import com.jpexs.decompiler.flash.tags.base.DrawableTag;
import com.jpexs.decompiler.flash.tags.base.RenderContext;
import com.jpexs.decompiler.flash.timeline.Timeline;
import com.jpexs.decompiler.flash.types.RECT;
import com.jpexs.helpers.ByteArrayRange;
import com.jpexs.helpers.SerializableImage;
import java.awt.Point;
import java.awt.Shape;
import java.awt.geom.Rectangle2D;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.imageio.ImageIO;

public final class ManorSwfMediaExporter {
  private static final int MARGIN_TWIPS = 20;

  private ManorSwfMediaExporter() {}

  public static void main(String[] args) throws Exception {
    if (args.length < 3) {
      throw new IllegalArgumentException(
        "Usage: ManorSwfMediaExporter <source-root> <output-root> <relative-swf> [relative-swf ...]"
      );
    }

    Path sourceRoot = Path.of(args[0]).toAbsolutePath().normalize();
    Path outputRoot = Path.of(args[1]).toAbsolutePath().normalize();
    Files.createDirectories(outputRoot);

    List<Path> sources = new ArrayList<>();
    for (int index = 2; index < args.length; index += 1) {
      Path source = sourceRoot.resolve(args[index]).normalize();
      if (!source.startsWith(sourceRoot)) {
        throw new IllegalArgumentException("Source escapes root: " + args[index]);
      }
      sources.add(source);
    }
    sources.sort(Comparator.comparing(path -> sourceRoot.relativize(path).toString()));

    System.out.println(String.join("\t",
      "source_file",
      "entry_kind",
      "character_id",
      "entry_name",
      "tag_type",
      "frame_count",
      "content_rect",
      "output_file",
      "sound_format",
      "sound_rate",
      "sound_channels",
      "sound_sample_count",
      "sound_data_bytes",
      "sound_duration_seconds",
      "error"
    ));

    for (Path source : sources) inspect(sourceRoot, outputRoot, source);
  }

  private static void inspect(Path sourceRoot, Path outputRoot, Path source) {
    String sourceFile = sourceRoot.relativize(source).toString().replace('\\', '/');
    if (!Files.isRegularFile(source)) {
      printRow(sourceFile, "source", "", "", "", "", "", "", "", "", "", "", "", "", "missing-source");
      return;
    }

    try (InputStream input = Files.newInputStream(source)) {
      SWF swf = new SWF(input, true);
      Path assetDirectory = outputRoot.resolve(sourceFile + ".assets");
      exportRoot(sourceFile, outputRoot, assetDirectory, swf);

      Map<Integer, String> symbolClasses = new LinkedHashMap<>();
      Map<Integer, String> exportAssets = new LinkedHashMap<>();
      for (Tag tag : swf.getTags()) {
        if (tag instanceof SymbolClassTag symbolClass) {
          for (int index = 0; index < symbolClass.tags.size(); index += 1) {
            int characterId = symbolClass.tags.get(index);
            if (characterId > 0) symbolClasses.put(characterId, symbolClass.names.get(index));
          }
        }
        if (tag instanceof ExportAssetsTag exportAssetsTag) {
          for (int index = 0; index < exportAssetsTag.tags.size(); index += 1) {
            int characterId = exportAssetsTag.tags.get(index);
            if (characterId > 0) exportAssets.put(characterId, exportAssetsTag.names.get(index));
          }
        }
      }

      Map<Integer, RenderResult> renderCache = new LinkedHashMap<>();
      exportMappings(sourceFile, outputRoot, assetDirectory, swf, "symbol-class", symbolClasses, renderCache);
      exportMappings(sourceFile, outputRoot, assetDirectory, swf, "export-asset", exportAssets, renderCache);

      for (Tag tag : swf.getTags()) {
        if (!(tag instanceof DefineSoundTag sound)) continue;
        long dataBytes = sound.getRawSoundData().stream().mapToLong(ByteArrayRange::getLength).sum();
        int rate = sound.getSoundFormat().samplingRate;
        double duration = rate <= 0 ? 0 : (double)sound.getTotalSoundSampleCount() / rate;
        String entryName = String.join(",", sound.getClassNames());
        if (entryName.isEmpty() && sound.getExportName() != null) entryName = sound.getExportName();
        printRow(
          sourceFile,
          "define-sound",
          Integer.toString(sound.getCharacterId()),
          entryName,
          sound.getClass().getSimpleName(),
          "",
          "",
          "",
          sound.getExportFormat().name(),
          Integer.toString(rate),
          sound.getSoundType() ? "2" : "1",
          Long.toString(sound.getTotalSoundSampleCount()),
          Long.toString(dataBytes),
          String.format(java.util.Locale.ROOT, "%.6f", duration),
          ""
        );
      }
    } catch (Exception error) {
      printRow(
        sourceFile,
        "source",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        error.getClass().getSimpleName() + ": " + error.getMessage()
      );
    }
  }

  private static void exportRoot(String sourceFile, Path outputRoot, Path assetDirectory, SWF swf) {
    try {
      Timeline timeline = swf.getTimeline();
      RECT contentRect = getContentRect(timeline, swf.displayRect);
      if (contentRect == null) {
        printRow(sourceFile, "root-frame", "0", "[root-frame]", "SWF", Integer.toString(timeline.getFrameCount()), "", "", "", "", "", "", "", "", "empty-outline");
        return;
      }
      Path output = assetDirectory.resolve("root.png");
      writeTimelineImage(timeline, contentRect, output);
      printRow(
        sourceFile,
        "root-frame",
        "0",
        "[root-frame]",
        "SWF",
        Integer.toString(timeline.getFrameCount()),
        formatRect(contentRect),
        outputRoot.relativize(output).toString().replace('\\', '/'),
        "",
        "",
        "",
        "",
        "",
        "",
        ""
      );
    } catch (Exception error) {
      printRow(sourceFile, "root-frame", "0", "[root-frame]", "SWF", "", "", "", "", "", "", "", "", "", error.getClass().getSimpleName() + ": " + error.getMessage());
    }
  }

  private static void exportMappings(
    String sourceFile,
    Path outputRoot,
    Path assetDirectory,
    SWF swf,
    String entryKind,
    Map<Integer, String> mappings,
    Map<Integer, RenderResult> renderCache
  ) {
    for (Map.Entry<Integer, String> mapping : mappings.entrySet()) {
      int characterId = mapping.getKey();
      CharacterTag character = swf.getCharacter(characterId);
      if (character == null) {
        printRow(sourceFile, entryKind, Integer.toString(characterId), mapping.getValue(), "", "", "", "", "", "", "", "", "", "", "missing-character");
        continue;
      }
      if (!(character instanceof DrawableTag drawable)) {
        printRow(sourceFile, entryKind, Integer.toString(characterId), mapping.getValue(), character.getClass().getSimpleName(), "", "", "", "", "", "", "", "", "", "not-drawable");
        continue;
      }

      RenderResult result = renderCache.get(characterId);
      if (result == null) {
        result = renderDrawable(outputRoot, assetDirectory, drawable);
        renderCache.put(characterId, result);
      }
      printRow(
        sourceFile,
        entryKind,
        Integer.toString(characterId),
        mapping.getValue(),
        character.getClass().getSimpleName(),
        Integer.toString(drawable.getNumFrames()),
        result.contentRect,
        result.outputFile,
        "",
        "",
        "",
        "",
        "",
        "",
        result.error
      );
    }
  }

  private static RenderResult renderDrawable(Path outputRoot, Path assetDirectory, DrawableTag drawable) {
    try {
      RenderContext renderContext = newRenderContext();
      Shape outline = drawable.getOutline(false, 0, 0, 0, renderContext, new Matrix(), false, null, 1.0);
      RECT contentRect = rectangleFromOutline(outline);
      if (contentRect == null) return new RenderResult("", "", "empty-outline");

      Path output = assetDirectory.resolve("character-" + drawable.getCharacterId() + ".png");
      int width = Math.max(1, (int)Math.ceil(contentRect.getWidth() / 20.0));
      int height = Math.max(1, (int)Math.ceil(contentRect.getHeight() / 20.0));
      SerializableImage image = new SerializableImage(width, height, SerializableImage.TYPE_INT_ARGB_PRE);
      image.fillTransparent();

      Matrix renderMatrix = new Matrix();
      renderMatrix.translate(-contentRect.Xmin, -contentRect.Ymin);
      ExportRectangle exportRectangle = new ExportRectangle(contentRect);
      drawable.toImage(
        0,
        0,
        0,
        renderContext,
        image,
        image,
        false,
        renderMatrix,
        new Matrix(),
        renderMatrix,
        renderMatrix,
        null,
        1.0,
        true,
        exportRectangle,
        exportRectangle,
        true,
        0,
        0,
        false,
        1
      );
      Files.createDirectories(output.getParent());
      if (!ImageIO.write(image.getBufferedImage(), "png", output.toFile())) {
        throw new IllegalStateException("No PNG writer available");
      }
      return new RenderResult(
        formatRect(contentRect),
        outputRoot.relativize(output).toString().replace('\\', '/'),
        ""
      );
    } catch (Exception error) {
      return new RenderResult("", "", error.getClass().getSimpleName() + ": " + error.getMessage());
    }
  }

  private static RECT getContentRect(Timeline timeline, RECT fallback) {
    RenderContext renderContext = newRenderContext();
    Shape outline = timeline.getOutline(false, 0, 0, renderContext, new Matrix(), false, null, 1.0);
    return rectangleFromOutline(outline);
  }

  private static RECT rectangleFromOutline(Shape outline) {
    if (outline == null) return null;
    Rectangle2D bounds = outline.getBounds2D();
    if (bounds.isEmpty()) return null;
    int xMin = (int)Math.floor(bounds.getMinX()) - MARGIN_TWIPS;
    int xMax = (int)Math.ceil(bounds.getMaxX()) + MARGIN_TWIPS;
    int yMin = (int)Math.floor(bounds.getMinY()) - MARGIN_TWIPS;
    int yMax = (int)Math.ceil(bounds.getMaxY()) + MARGIN_TWIPS;
    return new RECT(xMin, xMax, yMin, yMax);
  }

  private static void writeTimelineImage(Timeline timeline, RECT contentRect, Path output) throws Exception {
    int width = Math.max(1, (int)Math.ceil(contentRect.getWidth() / 20.0));
    int height = Math.max(1, (int)Math.ceil(contentRect.getHeight() / 20.0));
    SerializableImage image = new SerializableImage(width, height, SerializableImage.TYPE_INT_ARGB_PRE);
    image.fillTransparent();

    Matrix renderMatrix = new Matrix();
    renderMatrix.translate(-contentRect.Xmin, -contentRect.Ymin);
    ExportRectangle exportRectangle = new ExportRectangle(contentRect);
    timeline.toImage(
      0,
      0,
      newRenderContext(),
      image,
      image,
      false,
      renderMatrix,
      new Matrix(),
      renderMatrix,
      null,
      1.0,
      true,
      exportRectangle,
      exportRectangle,
      renderMatrix,
      true,
      0,
      0,
      false,
      new ArrayList<>(),
      1
    );
    Files.createDirectories(output.getParent());
    if (!ImageIO.write(image.getBufferedImage(), "png", output.toFile())) {
      throw new IllegalStateException("No PNG writer available");
    }
  }

  private static RenderContext newRenderContext() {
    RenderContext renderContext = new RenderContext();
    renderContext.cursorPosition = new Point(-1, -1);
    renderContext.mouseButton = 0;
    renderContext.stateUnderCursor = new ArrayList<>();
    return renderContext;
  }

  private static String formatRect(RECT rectangle) {
    return rectangle.Xmin + "," + rectangle.Ymin + "," + rectangle.Xmax + "," + rectangle.Ymax;
  }

  private static void printRow(String... values) {
    System.out.println(String.join("\t", values).replace('\r', ' ').replace('\n', ' '));
  }

  private record RenderResult(String contentRect, String outputFile, String error) {}
}
