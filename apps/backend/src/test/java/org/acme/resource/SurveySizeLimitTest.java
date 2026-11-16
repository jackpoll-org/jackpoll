package org.acme.resource;

import static io.restassured.RestAssured.given;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

@QuarkusTest
class SurveySizeLimitTest {

    private static final String SURVEYS = "/api/v1/surveys";

    private static String create() {
        return given().contentType(ContentType.JSON).body("{\"title\":\"Big\"}")
            .when().post(SURVEYS).then().statusCode(201).extract().path("data.id");
    }

    private static io.restassured.response.ValidatableResponse save(String id, String questions, String sections) {
        return given().contentType(ContentType.JSON)
            .body("{\"title\":\"Big\",\"status\":\"draft\",\"questions\":[" + questions + "],\"sections\":[" + sections + "]}")
            .when().put(SURVEYS + "/" + id).then();
    }

    private static String questions(int n, boolean ownSection) {
        return IntStream.range(0, n).mapToObj(i -> "{\"type\":\"short-answer\",\"title\":\"Q" + i
                + "\",\"required\":false,\"order\":" + i + (ownSection ? ",\"sectionId\":\"s" + i + "\"" : "") + "}")
            .collect(Collectors.joining(","));
    }

    private static String sections(int n) {
        return IntStream.range(0, n).mapToObj(i -> "{\"id\":\"s" + i + "\",\"order\":" + i + "}")
            .collect(Collectors.joining(","));
    }

    @Test
    @TestSecurity(user = "owner-size")
    void acceptsSurveysAtTheLimits() {
        save(create(), questions(2000, false), sections(500)).statusCode(200);
    }

    @Test
    @TestSecurity(user = "owner-size")
    void rejectsTooManyQuestions() {
        save(create(), questions(2001, false), "").statusCode(422);
    }

    @Test
    @TestSecurity(user = "owner-size")
    void rejectsTooManySections() {
        save(create(), questions(1, false), sections(501)).statusCode(422);
    }

    @Test
    @TestSecurity(user = "owner-size")
    void rejectsTooManyPagesCreatedFromQuestionsWithoutChangingTheSurvey() {
        String id = create();
        save(id, questions(1, false), "").statusCode(200);
        save(id, questions(501, true), "").statusCode(400);
        given().when().get(SURVEYS + "/" + id).then().statusCode(200)
            .body("data.questions.size()", org.hamcrest.Matchers.is(1))
            .body("data.sections.size()", org.hamcrest.Matchers.is(0));
    }
}
