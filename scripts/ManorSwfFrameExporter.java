import com.jpexs.decompiler.flash.SWF;
import com.jpexs.decompiler.flash.exporters.commonshape.ExportRectangle;
import com.jpexs.decompiler.flash.exporters.commonshape.Matrix;
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
import java.util.List;
import java.util.Locale;
import java.util.stream.Stream;
import javax.imageio.ImageIO;

public final class ManorSwfFrameExporter {
  private static final int MARGIN_TWIPS = 20;

  private ManorSwfFrameExporter() {}

  public static void main(String[] args) throws Exception {
    if (args.length != 2) {
      throw new IllegalArgumentException("Usage: ManorSwfFrameExporter <swf-directory> <output-directory>");
    }

    Path root = Path.of(args[0]).toAbsolutePath().normalize();
    Path outputRoot = Path.of(args[1]).toAbsolutePath().normalize();
    Files.createDirectories(outputRoot);

    List<Path> swfFiles;
    try (Stream<Path> paths = Files.walk(root)) {
      swfFiles = paths
        .filter(Files::isRegularFile)
        .filter(path -> path.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(".swf"))
        .sorted(Comparator.comparing(path -> root.relativize(path).toString()))
        .toList();
    }

    System.out.println(String.join("\t", "source_file", "display_rect", "content_rect", "output_file", "error"));
    for (Path source : swfFiles) export(root, outputRoot, source);
  }

  private static void export(Path root, Path outputRoot, Path source) {
    String sourceFile = root.relativize(source).toString().replace('\\', '/');
    Path output = outputRoot.resolve(sourceFile + ".png");
    try (InputStream input = Files.newInputStream(source)) {
      SWF swf = new SWF(input, true);
      RECT contentRect = getContentRect(swf);
      SerializableImage image = renderFirstFrame(swf, contentRect);

      Files.createDirectories(output.getParent());
      if (!ImageIO.write(image.getBufferedImage(), "png", output.toFile())) {
        throw new IllegalStateException("No PNG writer available");
      }
      printRow(sourceFile, formatRect(swf.displayRect), formatRect(contentRect), outputRoot.relativize(output).toString(), "");
    } catch (Exception error) {
      String location = error.getStackTrace().length == 0 ? "" : " at " + error.getStackTrace()[0];
      printRow(sourceFile, "", "", "", error.getClass().getSimpleName() + ": " + error.getMessage() + location);
    }
  }

  private static RECT getContentRect(SWF swf) {
    RenderContext renderContext = new RenderContext();
    renderContext.cursorPosition = new Point(-1, -1);
    renderContext.stateUnderCursor = new ArrayList<>();
    Shape outline = swf.getTimeline().getOutline(false, 0, 0, renderContext, new Matrix(), false, null, 1.0);
    if (outline == null) return new RECT(swf.displayRect);

    Rectangle2D bounds = outline.getBounds2D();
    if (bounds.isEmpty()) return new RECT(swf.displayRect);

    int xMin = (int)Math.floor(bounds.getMinX()) - MARGIN_TWIPS;
    int xMax = (int)Math.ceil(bounds.getMaxX()) + MARGIN_TWIPS;
    int yMin = (int)Math.floor(bounds.getMinY()) - MARGIN_TWIPS;
    int yMax = (int)Math.ceil(bounds.getMaxY()) + MARGIN_TWIPS;
    return new RECT(xMin, xMax, yMin, yMax);
  }

  private static SerializableImage renderFirstFrame(SWF swf, RECT contentRect) {
    int width = Math.max(1, (int)Math.ceil(contentRect.getWidth() / 20.0));
    int height = Math.max(1, (int)Math.ceil(contentRect.getHeight() / 20.0));
    SerializableImage image = new SerializableImage(width, height, SerializableImage.TYPE_INT_ARGB_PRE);
    image.fillTransparent();

    Matrix renderMatrix = new Matrix();
    renderMatrix.translate(-contentRect.Xmin, -contentRect.Ymin);
    RenderContext renderContext = new RenderContext();
    renderContext.cursorPosition = new Point(-1, -1);
    renderContext.mouseButton = 0;
    renderContext.stateUnderCursor = new ArrayList<>();
    ExportRectangle exportRectangle = new ExportRectangle(contentRect);

    swf.getTimeline().toImage(
      0,
      0,
      renderContext,
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
    return image;
  }

  private static String formatRect(RECT rectangle) {
    return rectangle.Xmin + "," + rectangle.Ymin + "," + rectangle.Xmax + "," + rectangle.Ymax;
  }

  private static void printRow(String... values) {
    System.out.println(String.join("\t", values).replace('\r', ' ').replace('\n', ' '));
  }
}
