package org.acme.entity;

import java.util.Map;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * A section groups ordered questions into a page of a multi-page survey
 * (issue #28). Stored as JSON on {@link Survey}; questions reference a section
 * by id. Flat surveys simply have no sections.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class Section {

    public String id;
    public String title;
    public String description;
    public int order;

    /** Optional conditional-visibility rule (a LogicRule), extends issue #6. */
    public Map<String, Object> visibleIf;
}
