package br.com.capivapp.icp;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Minimal, dependency-free JSON reader/writer.
 *
 * The helper speaks a small, fixed protocol over loopback stdin/stdout, so a
 * full JSON library would be dead weight in the shipped JRE. This parser is
 * deliberately strict and tiny — it covers objects, arrays, strings (with the
 * standard escapes), numbers, booleans and null, which is the entire surface
 * of the desktop<->helper contract.
 */
final class Json {
  private Json() {}

  // ---- parsing ----------------------------------------------------------

  static Object parse(String text) {
    Parser parser = new Parser(text);
    Object value = parser.readValue();
    parser.skipWhitespace();
    if (!parser.atEnd()) {
      throw new IllegalArgumentException("Trailing characters after JSON value");
    }
    return value;
  }

  @SuppressWarnings("unchecked")
  static Map<String, Object> asObject(Object value) {
    if (!(value instanceof Map)) {
      throw new IllegalArgumentException("Expected JSON object");
    }
    return (Map<String, Object>) value;
  }

  static String str(Map<String, Object> obj, String key) {
    Object value = obj.get(key);
    if (value == null) {
      return null;
    }
    return value.toString();
  }

  private static final class Parser {
    private final String src;
    private int pos;

    Parser(String src) {
      this.src = src;
    }

    boolean atEnd() {
      return pos >= src.length();
    }

    void skipWhitespace() {
      while (pos < src.length() && Character.isWhitespace(src.charAt(pos))) {
        pos++;
      }
    }

    Object readValue() {
      skipWhitespace();
      char c = peek();
      return switch (c) {
        case '{' -> readObject();
        case '[' -> readArray();
        case '"' -> readString();
        case 't', 'f' -> readBoolean();
        case 'n' -> readNull();
        default -> readNumber();
      };
    }

    private Map<String, Object> readObject() {
      Map<String, Object> obj = new LinkedHashMap<>();
      expect('{');
      skipWhitespace();
      if (peek() == '}') {
        pos++;
        return obj;
      }
      while (true) {
        skipWhitespace();
        String key = readString();
        skipWhitespace();
        expect(':');
        obj.put(key, readValue());
        skipWhitespace();
        char c = next();
        if (c == '}') {
          return obj;
        }
        if (c != ',') {
          throw err("Expected ',' or '}' in object");
        }
      }
    }

    private List<Object> readArray() {
      List<Object> list = new ArrayList<>();
      expect('[');
      skipWhitespace();
      if (peek() == ']') {
        pos++;
        return list;
      }
      while (true) {
        list.add(readValue());
        skipWhitespace();
        char c = next();
        if (c == ']') {
          return list;
        }
        if (c != ',') {
          throw err("Expected ',' or ']' in array");
        }
      }
    }

    private String readString() {
      expect('"');
      StringBuilder sb = new StringBuilder();
      while (true) {
        char c = next();
        if (c == '"') {
          return sb.toString();
        }
        if (c == '\\') {
          char esc = next();
          switch (esc) {
            case '"' -> sb.append('"');
            case '\\' -> sb.append('\\');
            case '/' -> sb.append('/');
            case 'b' -> sb.append('\b');
            case 'f' -> sb.append('\f');
            case 'n' -> sb.append('\n');
            case 'r' -> sb.append('\r');
            case 't' -> sb.append('\t');
            case 'u' -> {
              sb.append((char) Integer.parseInt(src.substring(pos, pos + 4), 16));
              pos += 4;
            }
            default -> throw err("Invalid escape \\" + esc);
          }
        } else {
          sb.append(c);
        }
      }
    }

    private Boolean readBoolean() {
      if (src.startsWith("true", pos)) {
        pos += 4;
        return Boolean.TRUE;
      }
      if (src.startsWith("false", pos)) {
        pos += 5;
        return Boolean.FALSE;
      }
      throw err("Invalid literal");
    }

    private Object readNull() {
      if (src.startsWith("null", pos)) {
        pos += 4;
        return null;
      }
      throw err("Invalid literal");
    }

    private Double readNumber() {
      int start = pos;
      while (pos < src.length() && "-+.eE0123456789".indexOf(src.charAt(pos)) >= 0) {
        pos++;
      }
      return Double.parseDouble(src.substring(start, pos));
    }

    private char peek() {
      if (atEnd()) {
        throw err("Unexpected end of input");
      }
      return src.charAt(pos);
    }

    private char next() {
      char c = peek();
      pos++;
      return c;
    }

    private void expect(char expected) {
      char c = next();
      if (c != expected) {
        throw err("Expected '" + expected + "' but got '" + c + "'");
      }
    }

    private IllegalArgumentException err(String message) {
      return new IllegalArgumentException(message + " at position " + pos);
    }
  }

  // ---- writing ----------------------------------------------------------

  static String write(Object value) {
    StringBuilder sb = new StringBuilder();
    writeValue(sb, value);
    return sb.toString();
  }

  @SuppressWarnings("unchecked")
  private static void writeValue(StringBuilder sb, Object value) {
    if (value == null) {
      sb.append("null");
    } else if (value instanceof Map) {
      writeObject(sb, (Map<String, Object>) value);
    } else if (value instanceof List) {
      writeArray(sb, (List<Object>) value);
    } else if (value instanceof String s) {
      writeString(sb, s);
    } else if (value instanceof Boolean || value instanceof Number) {
      sb.append(value);
    } else {
      writeString(sb, value.toString());
    }
  }

  private static void writeObject(StringBuilder sb, Map<String, Object> obj) {
    sb.append('{');
    boolean first = true;
    for (Map.Entry<String, Object> entry : obj.entrySet()) {
      if (!first) {
        sb.append(',');
      }
      first = false;
      writeString(sb, entry.getKey());
      sb.append(':');
      writeValue(sb, entry.getValue());
    }
    sb.append('}');
  }

  private static void writeArray(StringBuilder sb, List<Object> list) {
    sb.append('[');
    for (int i = 0; i < list.size(); i++) {
      if (i > 0) {
        sb.append(',');
      }
      writeValue(sb, list.get(i));
    }
    sb.append(']');
  }

  private static void writeString(StringBuilder sb, String s) {
    sb.append('"');
    for (int i = 0; i < s.length(); i++) {
      char c = s.charAt(i);
      switch (c) {
        case '"' -> sb.append("\\\"");
        case '\\' -> sb.append("\\\\");
        case '\n' -> sb.append("\\n");
        case '\r' -> sb.append("\\r");
        case '\t' -> sb.append("\\t");
        case '\b' -> sb.append("\\b");
        case '\f' -> sb.append("\\f");
        default -> {
          if (c < 0x20) {
            sb.append(String.format("\\u%04x", (int) c));
          } else {
            sb.append(c);
          }
        }
      }
    }
    sb.append('"');
  }
}
