import com.jpexs.decompiler.flash.SWF;
import com.jpexs.decompiler.flash.exporters.commonshape.ExportRectangle;
import com.jpexs.decompiler.flash.exporters.commonshape.Matrix;
import com.jpexs.decompiler.flash.tags.SymbolClassTag;
import com.jpexs.decompiler.flash.tags.Tag;
import com.jpexs.decompiler.flash.tags.DefineSpriteTag;
import com.jpexs.decompiler.flash.tags.base.CharacterTag;
import com.jpexs.decompiler.flash.tags.base.DrawableTag;
import com.jpexs.decompiler.flash.tags.base.PlaceObjectTypeTag;
import com.jpexs.decompiler.flash.tags.base.RenderContext;
import com.jpexs.decompiler.flash.types.RECT;
import com.jpexs.helpers.SerializableImage;
import java.awt.Point;
import java.awt.Shape;
import java.awt.geom.Rectangle2D;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.imageio.ImageIO;

public final class ManorV7CatalogExporter {
  private static final int MARGIN_TWIPS = 20;
  private static final Map<String, String> CROP_STATES = Map.of(
    "Seed", "seed",
    "0", "sprout",
    "1", "young",
    "2", "growing",
    "3", "mature",
    "4", "withered"
  );
  private static final Map<Integer, String> ANIMAL_STATES = Map.of(
    1, "cub",
    2, "growing",
    3, "mature",
    4, "producing-a",
    5, "producing-b",
    6, "retired"
  );

  private ManorV7CatalogExporter() {}

  public static void main(String[] args) throws Exception {
    if (args.length != 4) {
      throw new IllegalArgumentException("Usage: ManorV7CatalogExporter <crop|animal> <source-directory> <output-directory> <id-file>");
    }
    String mode = args[0];
    Path sourceDirectory = Path.of(args[1]).toAbsolutePath().normalize();
    Path outputDirectory = Path.of(args[2]).toAbsolutePath().normalize();
    Path idFile = Path.of(args[3]).toAbsolutePath().normalize();
    Files.createDirectories(outputDirectory);

    List<Integer> ids = Files.readAllLines(idFile).stream()
      .map(String::trim)
      .filter(value -> !value.isEmpty())
      .map(Integer::parseInt)
      .sorted()
      .toList();

    System.out.println(String.join("\t",
      "domain", "source_id", "state_key", "source_file", "source_class", "character_id", "rendered_character_id",
      "export_strategy", "frame_count", "selected_frame", "content_rect_twips", "width", "height", "runtime_asset", "error"
    ));
    if (mode.equals("crop")) {
      for (int id : ids) exportCrop(sourceDirectory, outputDirectory, id);
    } else if (mode.equals("animal")) {
      for (int id : ids) exportAnimal(sourceDirectory, outputDirectory, id);
    } else {
      throw new IllegalArgumentException("Unknown export mode: " + mode);
    }
  }

  private static void exportCrop(Path sourceDirectory, Path outputDirectory, int id) {
    List<String> tokens = List.of("Seed", "0", "1", "2", "3", "4");
    for (String token : tokens) {
      String fileName = "Crop_" + id + "_" + token + ".swf";
      Path source = sourceDirectory.resolve(fileName);
      String state = CROP_STATES.get(token);
      try (InputStream input = Files.newInputStream(source)) {
        SWF swf = new SWF(input, true);
        Map<Integer, String> classes = symbolClasses(swf);
        Map.Entry<Integer, String> root = classes.entrySet().stream().findFirst().orElseThrow();
        Path output = outputDirectory.resolve("crops").resolve(Integer.toString(id)).resolve(state + ".png");
        RenderResult result = render(swf, root.getKey(), output);
        printRow("farm", id, state, "ui/allcrops/" + fileName, root.getValue(), root.getKey(), result, outputDirectory);
      } catch (Exception error) {
        printError("farm", id, state, "ui/allcrops/" + fileName, error);
      }
    }
  }

  private static void exportAnimal(Path sourceDirectory, Path outputDirectory, int id) {
    Pattern statePattern = Pattern.compile("^Animal_" + id + "_([1-6])$");
    Map<Integer, AnimalSource> states = new LinkedHashMap<>();
    for (int part = 0; part <= 1; part += 1) {
      String fileName = "a" + id + "_" + part + ".swf";
      Path source = sourceDirectory.resolve(fileName);
      try (InputStream input = Files.newInputStream(source)) {
        SWF swf = new SWF(input, true);
        for (Map.Entry<Integer, String> entry : symbolClasses(swf).entrySet()) {
          Matcher matcher = statePattern.matcher(entry.getValue());
          if (!matcher.matches()) continue;
          int state = Integer.parseInt(matcher.group(1));
          states.put(state, new AnimalSource(swf, "mc/farm/aswf/" + fileName, entry.getKey(), entry.getValue(), input));
        }
        for (int state : new ArrayList<>(states.keySet())) {
          AnimalSource animal = states.get(state);
          if (!animal.sourceFile.endsWith(fileName)) continue;
          String stateKey = ANIMAL_STATES.get(state);
          Path output = outputDirectory.resolve("animals").resolve(Integer.toString(id)).resolve(stateKey + ".png");
          try {
            RenderResult result = render(swf, animal.characterId, output);
            printRow("pasture", id, stateKey, animal.sourceFile, animal.className, animal.characterId, result, outputDirectory);
          } catch (Exception error) {
            printError("pasture", id, stateKey, animal.sourceFile, error);
          }
        }
      } catch (Exception error) {
        printError("pasture", id, "part-" + part, "mc/farm/aswf/" + fileName, error);
      }
    }
    for (int state = 1; state <= 6; state += 1) {
      if (!states.containsKey(state)) {
        printRaw("pasture", Integer.toString(id), ANIMAL_STATES.get(state), "", "", "", "", "", "", "", "", "", "", "", "missing-state-class");
      }
    }
  }

  private static Map<Integer, String> symbolClasses(SWF swf) {
    Map<Integer, String> classes = new LinkedHashMap<>();
    for (Tag tag : swf.getTags()) {
      if (!(tag instanceof SymbolClassTag symbolClass)) continue;
      for (int index = 0; index < symbolClass.tags.size(); index += 1) {
        int characterId = symbolClass.tags.get(index);
        if (characterId > 0) classes.put(characterId, symbolClass.names.get(index));
      }
    }
    return classes;
  }

  private static RenderResult render(SWF swf, int characterId, Path output) throws Exception {
    RenderCandidate candidate = findRenderable(swf, characterId, new HashSet<>());
    if (candidate == null) throw new IllegalStateException("empty-outline");
    DrawableTag drawable = candidate.drawable;
    int frameCount = Math.max(1, drawable.getNumFrames());
    int selectedFrame = candidate.selectedFrame;
    RECT contentRect = candidate.contentRect;

    RenderContext renderContext = newRenderContext();
    int width = Math.max(1, (int)Math.ceil(contentRect.getWidth() / 20.0));
    int height = Math.max(1, (int)Math.ceil(contentRect.getHeight() / 20.0));
    SerializableImage image = new SerializableImage(width, height, SerializableImage.TYPE_INT_ARGB_PRE);
    image.fillTransparent();
    Matrix renderMatrix = new Matrix();
    renderMatrix.translate(-contentRect.Xmin, -contentRect.Ymin);
    ExportRectangle exportRectangle = new ExportRectangle(contentRect);
    drawable.toImage(
      selectedFrame, 0, 0, renderContext, image, image, false, renderMatrix, new Matrix(), renderMatrix, renderMatrix,
      null, 1.0, true, exportRectangle, exportRectangle, true, 0, 0, false, 1
    );
    Files.createDirectories(output.getParent());
    if (!ImageIO.write(image.getBufferedImage(), "png", output.toFile())) throw new IllegalStateException("png-writer-missing");
    String strategy = candidate.characterId == characterId ? "root-symbol" : "last-visible-child";
    return new RenderResult(candidate.characterId, strategy, frameCount, selectedFrame, formatRect(contentRect), width, height, output);
  }

  private static RenderCandidate findRenderable(SWF swf, int characterId, Set<Integer> visited) {
    if (characterId <= 0 || !visited.add(characterId)) return null;
    CharacterTag character = swf.getCharacter(characterId);
    if (character instanceof DrawableTag drawable) {
      int frameCount = Math.max(1, drawable.getNumFrames());
      for (int frame = 0; frame < frameCount; frame += 1) {
        try {
          Shape outline = drawable.getOutline(false, frame, 0, 0, newRenderContext(), new Matrix(), false, null, 1.0);
          RECT contentRect = rectangleFromOutline(outline);
          if (contentRect != null) return new RenderCandidate(characterId, drawable, frame, contentRect);
        } catch (RuntimeException ignored) {
          // Animated V7 assets can have script-only or empty setup frames.
        }
      }
    }

    if (character instanceof DefineSpriteTag sprite) {
      List<Integer> children = new ArrayList<>();
      for (Tag tag : sprite.getTags()) {
        if (tag instanceof PlaceObjectTypeTag placement && !placement.flagMove() && placement.getCharacterId() > 0) {
          children.add(placement.getCharacterId());
        }
      }
      for (int index = children.size() - 1; index >= 0; index -= 1) {
        RenderCandidate child = findRenderable(swf, children.get(index), visited);
        if (child != null) return child;
      }
    }
    return null;
  }

  private static RenderContext newRenderContext() {
    RenderContext context = new RenderContext();
    context.cursorPosition = new Point(-1, -1);
    context.mouseButton = 0;
    context.stateUnderCursor = new ArrayList<>();
    return context;
  }

  private static RECT rectangleFromOutline(Shape outline) {
    if (outline == null) return null;
    Rectangle2D bounds = outline.getBounds2D();
    if (bounds.isEmpty()) return null;
    return new RECT(
      (int)Math.floor(bounds.getMinX()) - MARGIN_TWIPS,
      (int)Math.ceil(bounds.getMaxX()) + MARGIN_TWIPS,
      (int)Math.floor(bounds.getMinY()) - MARGIN_TWIPS,
      (int)Math.ceil(bounds.getMaxY()) + MARGIN_TWIPS
    );
  }

  private static void printRow(String domain, int id, String state, String sourceFile, String className, int characterId, RenderResult result, Path outputRoot) {
    printRaw(
      domain, Integer.toString(id), state, sourceFile, className, Integer.toString(characterId), Integer.toString(result.renderedCharacterId),
      result.strategy, Integer.toString(result.frameCount), Integer.toString(result.selectedFrame), result.contentRect, Integer.toString(result.width), Integer.toString(result.height),
      outputRoot.relativize(result.output).toString().replace('\\', '/'), ""
    );
  }

  private static void printError(String domain, int id, String state, String sourceFile, Exception error) {
    printRaw(domain, Integer.toString(id), state, sourceFile, "", "", "", "", "", "", "", "", "", "", error.getClass().getSimpleName() + ": " + error.getMessage());
  }

  private static void printRaw(String... values) {
    System.out.println(String.join("\t", values).replace('\r', ' ').replace('\n', ' '));
  }

  private static String formatRect(RECT rectangle) {
    return rectangle.Xmin + "," + rectangle.Ymin + "," + rectangle.Xmax + "," + rectangle.Ymax;
  }

  private record RenderCandidate(int characterId, DrawableTag drawable, int selectedFrame, RECT contentRect) {}
  private record RenderResult(int renderedCharacterId, String strategy, int frameCount, int selectedFrame, String contentRect, int width, int height, Path output) {}
  private record AnimalSource(SWF swf, String sourceFile, int characterId, String className, InputStream input) {}
}
