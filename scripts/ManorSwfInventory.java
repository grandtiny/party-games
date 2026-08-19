import com.jpexs.decompiler.flash.SWF;
import com.jpexs.decompiler.flash.tags.DefineSpriteTag;
import com.jpexs.decompiler.flash.tags.SymbolClassTag;
import com.jpexs.decompiler.flash.tags.Tag;
import com.jpexs.decompiler.flash.tags.base.CharacterTag;
import com.jpexs.decompiler.flash.tags.base.PlaceObjectTypeTag;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Stream;

public final class ManorSwfInventory {
  private ManorSwfInventory() {}

  public static void main(String[] args) throws Exception {
    if (args.length != 1) {
      throw new IllegalArgumentException("Usage: ManorSwfInventory <swf-directory>");
    }

    Path root = Path.of(args[0]).toAbsolutePath().normalize();
    List<Path> swfFiles;
    try (Stream<Path> paths = Files.walk(root)) {
      swfFiles = paths
        .filter(Files::isRegularFile)
        .filter(path -> path.getFileName().toString().toLowerCase(Locale.ROOT).endsWith(".swf"))
        .sorted(Comparator.comparing(path -> root.relativize(path).toString()))
        .toList();
    }

    System.out.println(String.join("\t",
      "source_file",
      "class_name",
      "root_sprite_id",
      "state_character_ids",
      "state_depths",
      "all_sprite_ids",
      "symbol_classes",
      "error"
    ));

    for (Path path : swfFiles) {
      inspect(root, path);
    }
  }

  private static void inspect(Path root, Path path) {
    String sourceFile = root.relativize(path).toString().replace('\\', '/');
    try (InputStream input = Files.newInputStream(path)) {
      SWF swf = new SWF(input, true);
      Map<Integer, String> classes = new LinkedHashMap<>();
      List<Integer> spriteIds = new ArrayList<>();

      for (Tag tag : swf.getTags()) {
        if (tag instanceof SymbolClassTag symbolClass) {
          for (int index = 0; index < symbolClass.tags.size(); index += 1) {
            int characterId = symbolClass.tags.get(index);
            String className = symbolClass.names.get(index);
            if (characterId > 0) classes.put(characterId, className);
          }
        }
        if (tag instanceof DefineSpriteTag sprite) spriteIds.add(sprite.spriteId);
      }

      Map.Entry<Integer, String> rootClass = selectRootClass(path, classes);
      int rootSpriteId = rootClass == null ? 0 : rootClass.getKey();
      String className = rootClass == null ? "" : rootClass.getValue();
      List<Integer> stateIds = new ArrayList<>();
      List<Integer> stateDepths = new ArrayList<>();
      CharacterTag rootCharacter = rootSpriteId == 0 ? null : swf.getCharacter(rootSpriteId);
      if (rootCharacter instanceof DefineSpriteTag rootSprite) {
        for (Tag child : rootSprite.getTags()) {
          if (child instanceof PlaceObjectTypeTag placement && !placement.flagMove()) {
            stateIds.add(placement.getCharacterId());
            stateDepths.add(placement.getDepth());
          }
        }
      }

      printRow(
        sourceFile,
        className,
        rootSpriteId == 0 ? "" : Integer.toString(rootSpriteId),
        join(stateIds),
        join(stateDepths),
        join(spriteIds),
        joinClasses(classes),
        ""
      );
    } catch (Exception error) {
      printRow(sourceFile, "", "", "", "", "", "", error.getClass().getSimpleName() + ": " + error.getMessage());
    }
  }

  private static Map.Entry<Integer, String> selectRootClass(Path path, Map<Integer, String> classes) {
    String fileName = path.getFileName().toString();
    String baseName = fileName.substring(0, fileName.length() - 4);
    for (Map.Entry<Integer, String> entry : classes.entrySet()) {
      String className = entry.getValue();
      int separator = Math.max(className.lastIndexOf('.'), className.lastIndexOf(':'));
      String simpleName = separator >= 0 ? className.substring(separator + 1) : className;
      if (simpleName.equalsIgnoreCase(baseName)) return entry;
    }
    return classes.entrySet().stream().findFirst().orElse(null);
  }

  private static String join(List<Integer> values) {
    return values.stream().map(String::valueOf).reduce((left, right) -> left + "," + right).orElse("");
  }

  private static String joinClasses(Map<Integer, String> classes) {
    return classes.entrySet().stream()
      .map(entry -> entry.getKey() + ":" + entry.getValue())
      .reduce((left, right) -> left + "," + right)
      .orElse("");
  }

  private static void printRow(String... values) {
    System.out.println(String.join("\t", values).replace('\r', ' ').replace('\n', ' '));
  }
}
