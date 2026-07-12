package org.acme.entity;

/**
 * Distinguishes the role of a {@link QuestionOption} so that plain choice
 * options and grid rows/columns can share a single table.
 *
 * <ul>
 *   <li>{@code OPTION} — a selectable choice (multiple-choice, checkboxes, dropdown)</li>
 *   <li>{@code ROW} — a grid row label (multiple-choice-grid, checkbox-grid)</li>
 *   <li>{@code COLUMN} — a grid column label (multiple-choice-grid, checkbox-grid)</li>
 * </ul>
 */
public enum OptionKind {
    OPTION,
    ROW,
    COLUMN
}
