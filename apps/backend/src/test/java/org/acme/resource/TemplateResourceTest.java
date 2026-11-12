package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;
import static org.hamcrest.Matchers.notNullValue;

import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import java.time.Instant;
import java.util.UUID;
import org.acme.entity.Template;
import org.junit.jupiter.api.Test;

@QuarkusTest
class TemplateResourceTest {

    private static final String BASE = "/api/v1/templates";

    @Test
    void templates_requireAuth() {
        given().when().get(BASE).then().statusCode(401);
    }

    @Test
    @TestSecurity(user = "owner-1")
    void create_list_rename_delete() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("""
                {
                  "name": "My template",
                  "description": "desc",
                  "questions": [{"id":"q1","type":"short-answer","title":"Name","required":true,"order":0}],
                  "settings": {"isQuiz": false}
                }
                """)
            .when().post(BASE)
            .then().statusCode(201)
            .body("data.id", notNullValue())
            .body("data.questions[0].title", is("Name"))
            .extract().path("data.id");

        given().when().get(BASE)
            .then().statusCode(200).body("data.size()", is(1));

        given()
            .contentType(ContentType.JSON)
            .body("{\"name\":\"Renamed\",\"description\":\"new\"}")
            .when().put(BASE + "/" + id)
            .then().statusCode(200).body("data.name", is("Renamed"));

        given().when().delete(BASE + "/" + id).then().statusCode(200);
        given().when().get(BASE).then().statusCode(200).body("data.size()", is(0));
    }

    @Test
    @TestSecurity(user = "owner-3")
    void keepsTheTemplatesPages() {
        given()
            .contentType(ContentType.JSON)
            .body("""
                {
                  "name": "Paged",
                  "questions": [{"id":"q1","type":"short-answer","title":"Fazit","required":false,"order":0,"sectionId":"reflexion"}],
                  "sections": [{"id":"reflexion","title":"Reflexion","order":0}]
                }
                """)
            .when().post(BASE)
            .then().statusCode(201)
            .body("data.sections[0].title", is("Reflexion"));

        given().when().get(BASE)
            .then().statusCode(200)
            .body("data[0].sections[0].id", is("reflexion"))
            .body("data[0].questions[0].sectionId", is("reflexion"));
    }

    @Test
    @TestSecurity(user = "owner-2")
    void cannotModifyOthersTemplate() {
        given()
            .contentType(ContentType.JSON)
            .body("{\"name\":\"x\"}")
            .when().put(BASE + "/does-not-exist")
            .then().statusCode(404);
    }

    @Test
    @TestSecurity(user = "template-big")
    void anOversizedTemplateIsRejected() {
        given().contentType(ContentType.JSON)
            .body("{\"name\":\"big\",\"questions\":[\"" + "x".repeat(1_100_000) + "\"]}")
            .when().post(BASE)
            .then().statusCode(400);
    }

    @Test
    @TestSecurity(user = "template-cap")
    void theTemplateCountPerUserIsCapped() {
        QuarkusTransaction.requiringNew().run(() -> {
            for (int i = 0; i < 100; i++) {
                var t = new Template();
                t.id = UUID.randomUUID().toString();
                t.ownerId = "template-cap";
                t.name = "t" + i;
                t.createdAt = Instant.now();
                t.updatedAt = Instant.now();
                t.persist();
            }
        });

        given().contentType(ContentType.JSON)
            .body("{\"name\":\"one too many\"}")
            .when().post(BASE)
            .then().statusCode(409);
    }
}
