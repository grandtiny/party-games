import com.jpexs.decompiler.flash.SWF;
import com.jpexs.decompiler.flash.tags.DefineSoundTag;
import com.jpexs.decompiler.flash.tags.DefineSpriteTag;
import com.jpexs.decompiler.flash.tags.Tag;
import com.jpexs.decompiler.flash.tags.base.SoundStreamHeadTypeTag;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.stream.Stream;

public final class ManorSwfAudioInventory {
  private ManorSwfAudioInventory() {}

  public static void main(String[] args) throws Exception {
    if (args.length != 1) {
      throw new IllegalArgumentException("Usage: ManorSwfAudioInventory <swf-directory>");
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
      "relative_path",
      "define_sound_count",
      "sound_stream_head_count",
      "swf_codec_ids",
      "swf_codecs",
      "sample_rates_hz",
      "sample_counts",
      "duration_seconds",
      "error"
    ));

    for (Path path : swfFiles) inspect(root, path);
  }

  private static void inspect(Path root, Path path) {
    String relativePath = root.relativize(path).toString().replace('\\', '/');
    try (InputStream input = Files.newInputStream(path)) {
      SWF swf = new SWF(input, true);
      List<DefineSoundTag> sounds = new ArrayList<>();
      int streamHeads = inspectTags(swf.getTags(), sounds);
      if (sounds.isEmpty() && streamHeads == 0) return;

      printRow(
        relativePath,
        Integer.toString(sounds.size()),
        Integer.toString(streamHeads),
        distinct(sounds.stream().map(sound -> Integer.toString(sound.getSoundFormatId())).toList()),
        distinct(sounds.stream().map(sound -> codecName(sound.getSoundFormatId())).toList()),
        distinct(sounds.stream().map(sound -> formatRate(sampleRate(sound.getSoundRate()))).toList()),
        sounds.stream().map(sound -> Long.toString(sound.getTotalSoundSampleCount())).reduce((left, right) -> left + "," + right).orElse(""),
        sounds.stream().map(sound -> formatDuration(sound.getTotalSoundSampleCount(), sampleRate(sound.getSoundRate())))
          .reduce((left, right) -> left + "," + right).orElse(""),
        ""
      );
    } catch (Exception error) {
      printRow(relativePath, "", "", "", "", "", "", "", error.getClass().getSimpleName() + ": " + error.getMessage());
    }
  }

  private static int inspectTags(Iterable<Tag> tags, List<DefineSoundTag> sounds) {
    int streamHeads = 0;
    for (Tag tag : tags) {
      if (tag instanceof DefineSoundTag sound) sounds.add(sound);
      if (tag instanceof SoundStreamHeadTypeTag) streamHeads += 1;
      if (tag instanceof DefineSpriteTag sprite) streamHeads += inspectTags(sprite.getTags(), sounds);
    }
    return streamHeads;
  }

  private static String codecName(int formatId) {
    return switch (formatId) {
      case 0 -> "uncompressed-native-endian";
      case 1 -> "adpcm";
      case 2 -> "mp3";
      case 3 -> "uncompressed-little-endian";
      case 4 -> "nellymoser-16khz";
      case 5 -> "nellymoser-8khz";
      case 6 -> "nellymoser";
      case 11 -> "speex";
      default -> "unknown-" + formatId;
    };
  }

  private static double sampleRate(int rateId) {
    return switch (rateId) {
      case 0 -> 5512.5;
      case 1 -> 11025.0;
      case 2 -> 22050.0;
      case 3 -> 44100.0;
      default -> 0.0;
    };
  }

  private static String formatRate(double rate) {
    if (rate == Math.rint(rate)) return Long.toString(Math.round(rate));
    return String.format(Locale.ROOT, "%.1f", rate);
  }

  private static String formatDuration(long samples, double rate) {
    if (rate <= 0.0) return "";
    return String.format(Locale.ROOT, "%.3f", samples / rate);
  }

  private static String distinct(List<String> values) {
    return values.stream().distinct().reduce((left, right) -> left + "," + right).orElse("");
  }

  private static void printRow(String... values) {
    System.out.println(String.join("\t", values).replace('\r', ' ').replace('\n', ' '));
  }
}
