DROP TABLE IF EXISTS config;
DROP FUNCTION IF EXISTS set_last_modified_column();
DROP TRIGGER IF EXISTS insert_config_last_modfied ON config;
DROP TRIGGER IF EXISTS update_config_last_modfied on config;
