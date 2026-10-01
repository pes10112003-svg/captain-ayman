-- Built-in measurement types available to every coach (idempotent).
INSERT INTO "measurement_types" ("coach_id", "key", "name", "kind", "unit", "is_system", "position")
SELECT NULL, v.key, v.name, v.kind::measurement_kind, v.unit, true, v.position
FROM (VALUES
  ('weight',      'Weight',          'mass',    'kg',    1),
  ('height',      'Height',          'length',  'cm',    2),
  ('body_fat',    'Body fat',        'percent', '%',     3),
  ('muscle_mass', 'Muscle mass',     'mass',    'kg',    4),
  ('bmi',         'BMI',             'index',   'kg/m²', 5),
  ('waist',       'Waist',           'length',  'cm',    6),
  ('abdomen',     'Abdomen',         'length',  'cm',    7),
  ('chest',       'Chest',           'length',  'cm',    8),
  ('shoulders',   'Shoulders',       'length',  'cm',    9),
  ('arms',        'Arms',            'length',  'cm',    10),
  ('thighs',      'Thighs',          'length',  'cm',    11),
  ('hips',        'Hips',            'length',  'cm',    12)
) AS v(key, name, kind, unit, position)
WHERE NOT EXISTS (
  SELECT 1 FROM "measurement_types" mt WHERE mt."coach_id" IS NULL AND mt."key" = v.key
);
