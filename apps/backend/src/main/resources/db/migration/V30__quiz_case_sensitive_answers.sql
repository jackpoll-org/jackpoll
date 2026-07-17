-- Case-sensitive grading toggle for short-answer quiz questions (default false =
-- keep existing case-insensitive behavior for all previously-created questions).
ALTER TABLE questions ADD COLUMN case_sensitive_answers BOOLEAN;
