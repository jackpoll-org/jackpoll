package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.notNullValue;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

@QuarkusTest
class FolderResourceTest {

    private static final String FOLDERS = "/api/v1/folders";
    private static final String SURVEYS = "/api/v1/surveys";

    @Test
    void folders_requireAuth() {
        given().when().get(FOLDERS).then().statusCode(401);
    }

    @Test
    @TestSecurity(user = "owner-1")
    void folderCrudAndOrganizeSurvey() {
        String folderId = given()
            .contentType(ContentType.JSON)
            .body("{\"name\":\"Work\"}")
            .when().post(FOLDERS)
            .then().statusCode(201)
            .body("data.id", notNullValue())
            .extract().path("data.id");

        String surveyId = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Organized\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");

        // assign tags + folder via the organize endpoint
        given()
            .contentType(ContentType.JSON)
            .body("{\"tags\":[\"important\",\"q3\"],\"folderId\":\"" + folderId + "\"}")
            .when().put(SURVEYS + "/" + surveyId + "/organize")
            .then().statusCode(200)
            .body("data.tags", hasItem("important"))
            .body("data.folderId", is(folderId));

        // deleting the folder unfiles its surveys
        given().when().delete(FOLDERS + "/" + folderId).then().statusCode(200);
        given().when().get(SURVEYS + "/" + surveyId)
            .then().statusCode(200)
            .body("data.folderId", is((Object) null))
            .body("data.tags", hasItem("q3"));
    }
}
