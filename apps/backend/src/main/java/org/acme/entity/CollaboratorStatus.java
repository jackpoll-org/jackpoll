package org.acme.entity;

/**
 * Whether a collaborator invitation has been accepted (#8). A PENDING invite is
 * visible to the invitee as an invitation but does not grant survey access until
 * they accept it.
 */
public enum CollaboratorStatus {
    PENDING,
    ACCEPTED
}
