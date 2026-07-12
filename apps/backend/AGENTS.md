# Project: Survey School Backend (survey-backend)

The backend for the Survey School application — a Google Forms-like survey/quiz builder.

## Tech Stack

- **Framework:** Quarkus 3.35.3
- **Language:** Java 21
- **Build Tool:** Maven 3 (wrapper included)
- **REST:** Jakarta RESTful Web Services (JAX-RS) via `quarkus-rest`
- **Dependency Injection:** Quarkus ArC (CDI)
- **Testing:** JUnit 5 + REST Assured + `@QuarkusTest`

## Architecture

### Package Structure

```
src/main/java/org/acme/
├── resource/          # REST endpoints (JAX-RS @Path classes)
├── service/           # Business logic layer
├── repository/        # Data access layer (JPA / Panache)
├── entity/            # JPA entity classes
├── dto/               # Request/response data transfer objects
├── mapper/            # MapStruct or manual entity<->DTO mappers
├── config/            # Application configuration classes
├── exception/         # Custom exceptions and exception mappers
└── security/          # Auth filters, identity providers, JWT handling

src/test/java/org/acme/
├── resource/          # REST endpoint integration tests
├── service/           # Unit tests for business logic
└── repository/        # Repository/Data access tests
```

### Layer Rules

1. **Resource layer** (`resource/`) — Only REST concerns:
   - Map HTTP methods to service calls
   - Handle request/response DTOs
   - Return consistent `ApiResponse<T>` envelope
   - Never contain business logic

2. **Service layer** (`service/`) — Business rules and orchestration:
   - Validate business constraints
   - Coordinate repositories
   - Apply transactions
   - Throw domain exceptions

3. **Repository layer** (`repository/`) — Data access only:
   - Use Panache (`PanacheEntity`, `PanacheRepository`) when JPA is active
   - Keep queries simple; delegate complex queries to a dedicated query class

4. **DTO layer** (`dto/`) — API contracts:
   - One DTO per request/response shape
   - Use records when possible (Java 21)
   - Share field names with the frontend model to avoid mapping drift

## API Response Format

Every endpoint must return a consistent envelope:

```java
public record ApiResponse<T>(
    boolean success,
    T data,
    String error,
    Meta meta
) {
    public record Meta(long total, int page, int limit) {}

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, data, null, null);
    }

    public static <T> ApiResponse<T> error(String message) {
        return new ApiResponse<>(false, null, message, null);
    }
}
```

## Database & JPA

- Use **Quarkus Hibernate ORM with Panache** for data access
- Prefer `PanacheEntity` for simple CRUD, `PanacheRepository` for custom queries
- Use Flyway or Liquibase for migrations (configure in `application.properties`)
- Map entity field names to frontend JSON keys explicitly with `@JsonProperty` if they differ

## Validation

- Use **Hibernate Validator** (`quarkus-hibernate-validator`)
- Annotate DTO fields with `@NotNull`, `@Size`, `@Email`, `@Pattern`, etc.
- Return `422 Unprocessable Entity` with structured validation errors

## Security

- Use **Quarkus Security** + **JWT** (`quarkus-smallrye-jwt`) or **OAuth2**
- Store passwords hashed with **BCrypt** (never plaintext)
- Rate-limit login endpoints (use `quarkus-rate-limiter` or a custom filter)
- Validate all inputs at resource boundaries
- Never trust data coming from the frontend — always re-validate on the server

## Testing

- **Unit tests:** JUnit 5 + Mockito for service-layer logic
- **Integration tests:** `@QuarkusTest` + REST Assured for REST endpoints
- Every resource must have at least one integration test covering the happy path
- Minimum test coverage: 80%
- Run tests: `./mvnw test`
- Run integration tests: `./mvnw verify -DskipITs=false`

## Frontend Sync

- **Implement backend and frontend in parallel** — verify that API contracts, types, and behavior match between `survey-backend` and `survey-frontend` before marking either side complete
- **Always check the `survey-frontend` project** (`../survey-frontend/`) before changing any API contract (path, method, request shape, response shape, field names)
- Do not break existing frontend contracts without a coordinated migration plan
- Share DTO field names with the frontend TypeScript interfaces to minimize mapping drift

## CORS

- Configure CORS in `application.properties` to allow `survey-frontend` origin:
  ```properties
  quarkus.http.cors=true
  quarkus.http.cors.origins=http://localhost:3000
  ```
- In production, restrict to the deployed frontend domain

## Dev Mode

```shell
./mvnw quarkus:dev
```

Dev UI available at: http://localhost:8080/q/dev/

## Docker

Pre-configured Dockerfiles in `src/main/docker/`:
- `Dockerfile.jvm` — JVM-based container
- `Dockerfile.native` — Native GraalVM image
- `Dockerfile.native-micro` — Micro native image

## Agent Workflow

When implementing backend features:
1. Check the relevant GitHub issue in `survey-frontend` for acceptance criteria and scope
2. Check `../survey-frontend/` to understand the exact data shapes and endpoints the frontend expects
3. Define/update DTOs in `dto/` first
4. Implement/update entities in `entity/`
5. Add repository methods in `repository/`
6. Implement business logic in `service/`
7. Expose REST endpoints in `resource/`
8. Write tests (unit + integration) before marking complete
9. Update this doc if architectural decisions change
