CREATE TABLE IF NOT EXISTS config (
    key VARCHAR(32) NOT NULL UNIQUE,
    data jsonb NOT NULL,
    last_modified timestamp NOT NULL
);

CREATE OR REPLACE FUNCTION set_last_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_modified = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS insert_config_last_modfied ON config;
CREATE TRIGGER insert_config_last_modfied BEFORE INSERT ON config FOR EACH ROW EXECUTE PROCEDURE set_last_modified_column();

DROP TRIGGER IF EXISTS update_config_last_modfied ON config;
CREATE TRIGGER update_config_last_modfied BEFORE UPDATE ON config FOR EACH ROW EXECUTE PROCEDURE set_last_modified_column();

