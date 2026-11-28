-- Every box gets one default location, so boxes created before multi-location keep
-- working unchanged. The name is data the box can edit, like the template's programs.
INSERT INTO locations (box_id, name, address, city, phone, is_default)
SELECT id, 'Sede principal', address, city, phone, true FROM boxes
WHERE NOT EXISTS (SELECT 1 FROM locations WHERE locations.box_id = boxes.id AND locations.is_default);
--> statement-breakpoint
UPDATE class_schedules SET location_id = locations.id
FROM locations
WHERE locations.box_id = class_schedules.box_id AND locations.is_default
  AND class_schedules.location_id IS NULL;
--> statement-breakpoint
UPDATE classes SET location_id = coalesce(
  (SELECT location_id FROM class_schedules
    WHERE class_schedules.box_id = classes.box_id AND class_schedules.id = classes.schedule_id),
  (SELECT id FROM locations WHERE locations.box_id = classes.box_id AND locations.is_default)
)
WHERE location_id IS NULL;
--> statement-breakpoint
ALTER TABLE class_schedules ALTER COLUMN location_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE classes ALTER COLUMN location_id SET NOT NULL;
--> statement-breakpoint
-- New boxes get their default location in the same transaction that creates them.
CREATE FUNCTION create_default_location() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO locations (box_id, name, address, city, phone, is_default)
  VALUES (NEW.id, 'Sede principal', NEW.address, NEW.city, NEW.phone, true);
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER boxes_create_default_location AFTER INSERT ON boxes
FOR EACH ROW EXECUTE FUNCTION create_default_location();
--> statement-breakpoint
-- A schedule or class inserted without a location goes to the box's default one, so
-- code written before multi-location (and the running deploy) keeps inserting rows.
-- NOT NULL is checked after BEFORE triggers, so a box without a default still fails.
CREATE FUNCTION fill_schedule_location() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.location_id IS NULL THEN
    SELECT id INTO NEW.location_id FROM locations
    WHERE box_id = NEW.box_id AND is_default;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER class_schedules_fill_location BEFORE INSERT ON class_schedules
FOR EACH ROW EXECUTE FUNCTION fill_schedule_location();
--> statement-breakpoint
-- A class without a location takes its schedule's, then the box's default.
CREATE FUNCTION fill_class_location() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.location_id IS NULL AND NEW.schedule_id IS NOT NULL THEN
    SELECT location_id INTO NEW.location_id FROM class_schedules
    WHERE box_id = NEW.box_id AND id = NEW.schedule_id;
  END IF;
  IF NEW.location_id IS NULL THEN
    SELECT id INTO NEW.location_id FROM locations
    WHERE box_id = NEW.box_id AND is_default;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER classes_fill_location BEFORE INSERT ON classes
FOR EACH ROW EXECUTE FUNCTION fill_class_location();
