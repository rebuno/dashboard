import type { JsonSchema } from "./api";

const MAX_DEPTH = 8;

// A placeholder value with every required property of the schema filled in.
export function inputSkeleton(schema: JsonSchema): unknown {
  return skeleton(schema, schema, 0);
}

function skeleton(node: JsonSchema, root: JsonSchema, depth: number): unknown {
  const s = resolve(node, root);
  if (depth > MAX_DEPTH) return null;
  if ("default" in s) return s.default;
  if ("const" in s) return s.const;
  if (Array.isArray(s.enum)) return s.enum[0] ?? null;
  const variants = s.anyOf ?? s.oneOf;
  if (Array.isArray(variants) && variants.length > 0)
    return skeleton(variants[0] as JsonSchema, root, depth + 1);
  const type = Array.isArray(s.type) ? s.type[0] : s.type;
  switch (type ?? (s.properties ? "object" : undefined)) {
    case "object": {
      const properties = (s.properties ?? {}) as Record<string, JsonSchema>;
      const required = Array.isArray(s.required)
        ? (s.required as string[])
        : [];
      return Object.fromEntries(
        required
          .filter((key) => key in properties)
          .map((key) => [key, skeleton(properties[key], root, depth + 1)]),
      );
    }
    case "array":
      return [];
    case "string":
      return "";
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return false;
    default:
      return null;
  }
}

function resolve(node: JsonSchema, root: JsonSchema): JsonSchema {
  const ref = node.$ref;
  if (typeof ref !== "string" || !ref.startsWith("#")) return node;
  let target: unknown = root;
  for (const part of ref.slice(1).split("/").filter(Boolean)) {
    if (typeof target !== "object" || target === null) return {};
    target = (target as JsonSchema)[
      part.replaceAll("~1", "/").replaceAll("~0", "~")
    ];
  }
  return typeof target === "object" && target !== null
    ? (target as JsonSchema)
    : {};
}
