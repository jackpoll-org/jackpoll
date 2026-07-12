package org.acme.entity;

/**
 * A score-based outcome / result page (issue #83). Stored inside the survey's
 * jsonb settings. After a quiz submit, the outcome whose [minScore, maxScore]
 * range contains the score is shown (e.g. "You are: Explorer").
 */
public class Outcome {
    public String id;
    public String title;
    public String description;
    public String imageUrl;
    public Integer minScore;
    public Integer maxScore;
}
