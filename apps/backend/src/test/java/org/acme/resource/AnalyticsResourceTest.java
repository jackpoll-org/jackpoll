package org.acme.resource;

import static io.restassured.RestAssured.given;
import static org.hamcrest.CoreMatchers.is;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.security.TestSecurity;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AnalyticsResourceTest {

    private static final String SURVEYS = "/api/v1/surveys";
    private static final String PUBLIC = "/api/v1/public/surveys";

    @Test
    void analytics_requireAuth() {
        given().when().get(SURVEYS + "/x/analytics").then().statusCode(401);
    }

    @Test
    @TestSecurity(user = "owner-1")
    void trackingAggregatesViewsBySource() {
        String id = given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Tracked\"}")
            .when().post(SURVEYS)
            .then().statusCode(201).extract().path("data.id");

        given()
            .contentType(ContentType.JSON)
            .body("{\"title\":\"Tracked\",\"status\":\"published\",\"questions\":[]}")
            .when().put(SURVEYS + "/" + id).then().statusCode(200);

        // two views from a referrer, one direct, then a submit
        given().contentType(ContentType.JSON)
            .body("{\"event\":\"view\",\"referrer\":\"https://www.google.com/search?q=x\",\"device\":\"mobile\"}")
            .when().post(PUBLIC + "/" + id + "/track").then().statusCode(204);
        given().contentType(ContentType.JSON)
            .body("{\"event\":\"view\",\"referrer\":\"https://www.google.com/\",\"device\":\"desktop\"}")
            .when().post(PUBLIC + "/" + id + "/track").then().statusCode(204);
        given().contentType(ContentType.JSON)
            .body("{\"event\":\"submit\"}")
            .when().post(PUBLIC + "/" + id + "/track").then().statusCode(204);

        given()
            .when().get(SURVEYS + "/" + id + "/analytics")
            .then().statusCode(200)
            .body("data.views", is(2))
            .body("data.submits", is(1))
            // referrer reduced to host; both views collapse into google.com
            .body("data.sources[0].key", is("google.com"))
            .body("data.sources[0].count", is(2));
    }
}
