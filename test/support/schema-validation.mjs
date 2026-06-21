export function matchesType(value, expected) {
  if (Array.isArray(expected)) {
    return expected.some(type => matchesType(value, type));
  }
  if (expected === "null") return value === null;
  if (expected === "array") return Array.isArray(value);
  if (expected === "integer") return Number.isInteger(value);
  return typeof value === expected && !Array.isArray(value) && value !== null;
}

function resolveLocalRef(rootSchema, ref) {
  return ref.split("/").slice(1).reduce((node, segment) => node?.[segment], rootSchema);
}

export function validateSchema(value, schema, schemas, path = "$", rootSchema = schema) {
  if (!schema) {
    return [`${path} has no schema`];
  }

  if (schema.$ref) {
    if (schema.$ref.startsWith("#/")) {
      const referencedSchema = resolveLocalRef(rootSchema, schema.$ref);
      if (!referencedSchema) {
        return [`${path} references unknown schema ${schema.$ref}`];
      }
      return validateSchema(value, referencedSchema, schemas, path, rootSchema);
    }
    const referencedSchema = schemas[schema.$ref];
    if (!referencedSchema) {
      return [`${path} references unknown schema ${schema.$ref}`];
    }
    return validateSchema(value, referencedSchema, schemas, path, referencedSchema);
  }

  const errors = [];
  if (schema.allOf) {
    for (const childSchema of schema.allOf) {
      errors.push(...validateSchema(value, childSchema, schemas, path, rootSchema));
    }
  }
  if (schema.anyOf) {
    const childErrors = schema.anyOf.map(childSchema => validateSchema(value, childSchema, schemas, path, rootSchema));
    if (childErrors.every(result => result.length > 0)) {
      errors.push(`${path} must match at least one allowed schema`);
    }
  }
  if (schema.not && validateSchema(value, schema.not, schemas, path, rootSchema).length === 0) {
    errors.push(`${path} must not match disallowed schema`);
  }
  if (schema.if) {
    const conditionMatches = validateSchema(value, schema.if, schemas, path, rootSchema).length === 0;
    if (conditionMatches && schema.then) {
      errors.push(...validateSchema(value, schema.then, schemas, path, rootSchema));
    }
    if (!conditionMatches && schema.else) {
      errors.push(...validateSchema(value, schema.else, schemas, path, rootSchema));
    }
  }
  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`${path} must equal ${JSON.stringify(schema.const)}`);
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path} must be one of ${schema.enum.join(", ")}`);
  }
  if (schema.type && !matchesType(value, schema.type)) {
    errors.push(`${path} must be ${Array.isArray(schema.type) ? schema.type.join(" or ") : schema.type}`);
    return errors;
  }
  if ((schema.type === "integer" || schema.type === "number" || Array.isArray(schema.type)) && typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${path} must be >= ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${path} must be <= ${schema.maximum}`);
    }
  }
  if (typeof value === "string" && schema.pattern) {
    const pattern = new RegExp(schema.pattern);
    if (!pattern.test(value)) {
      errors.push(`${path} must match ${schema.pattern}`);
    }
  }
  if (typeof value === "string" && schema.minLength !== undefined && value.length < schema.minLength) {
    errors.push(`${path} must have length >= ${schema.minLength}`);
  }
  const shouldValidateObjectShape = (schema.type === "object" || schema.required || schema.properties || schema.additionalProperties)
    && value
    && typeof value === "object"
    && !Array.isArray(value);
  if (shouldValidateObjectShape) {
    if (schema.minProperties !== undefined && Object.keys(value).length < schema.minProperties) {
      errors.push(`${path} must have at least ${schema.minProperties} propert${schema.minProperties === 1 ? "y" : "ies"}`);
    }
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push(`${path}.${key} is required`);
    }
    for (const [key, childValue] of Object.entries(value)) {
      const childSchema = schema.properties?.[key];
      if (childSchema) {
        errors.push(...validateSchema(childValue, childSchema, schemas, `${path}.${key}`, rootSchema));
      } else if (schema.additionalProperties === false) {
        errors.push(`${path}.${key} is not allowed`);
      } else if (typeof schema.additionalProperties === "object") {
        errors.push(...validateSchema(childValue, schema.additionalProperties, schemas, `${path}.${key}`, rootSchema));
      }
    }
  }
  if (schema.type === "array" && Array.isArray(value) && schema.items) {
    value.forEach((item, index) => {
      errors.push(...validateSchema(item, schema.items, schemas, `${path}[${index}]`, rootSchema));
    });
  }
  return errors;
}
