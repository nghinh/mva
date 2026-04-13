---
name: bmad-vnpt-java-springboot
description: Bundled VNPT Java Spring Boot backend skill pack and BMAD/OpenCode entrypoint.
---

# bmad-vnpt-java-springboot

This skill is the canonical VNPT Java Spring Boot backend skill for BMAD/OpenCode.
Use this as the canonical backend skill entrypoint for Java/Spring Boot work.

## Required Processing Order
1. Read the local repository files that are most relevant to the backend task.
2. Read local architecture and API documents under `docs/` when they exist.
3. Use the Spring Boot patterns below for controller, service, repository, DTO, validation, exception handling, caching, async processing, and production-safe defaults.
4. Make the smallest safe backend change that fits the project conventions.
5. Run relevant checks before declaring completion.

## Mandatory Backend Rules
- Prefer thin controllers and service-oriented business logic.
- Use explicit DTOs for request and response boundaries.
- Apply validation at the API boundary.
- Centralize exception handling.
- Preserve API contracts unless the task explicitly requires a change.
- Consider observability, transactions, caching, and async implications when relevant.
- Align with the actual repository structure instead of forcing a theoretical pattern.

## Java Spring Boot Reference Pack

---
name: bmad-vnpt-java-springboot
description: Spring Boot architecture patterns, REST API design, layered services, data access, caching, async processing, and logging. Use for Java Spring Boot backend work.
origin: ECC
---

# Spring Boot Development Patterns

Spring Boot architecture and API patterns for scalable, production-grade services.

## When to Activate

- Building REST APIs with Spring MVC or WebFlux
- Structuring controller → service → repository layers
- Configuring Spring Data JPA, caching, or async processing
- Adding validation, exception handling, or pagination
- Setting up profiles for dev/staging/production environments
- Implementing event-driven patterns with Spring Events or Kafka

## REST API Structure

```java
@RestController
@RequestMapping("/api/markets")
@Validated
class MarketController {
  private final MarketService marketService;

  MarketController(MarketService marketService) {
    this.marketService = marketService;
  }

  @GetMapping
  ResponseEntity<Page<MarketResponse>> list(
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    Page<Market> markets = marketService.list(PageRequest.of(page, size));
    return ResponseEntity.ok(markets.map(MarketResponse::from));
  }

  @PostMapping
  ResponseEntity<MarketResponse> create(@Valid @RequestBody CreateMarketRequest request) {
    Market market = marketService.create(request);
    return ResponseEntity.status(HttpStatus.CREATED).body(MarketResponse.from(market));
  }
}
```

## Repository Pattern (Spring Data JPA)

```java
public interface MarketRepository extends JpaRepository<MarketEntity, Long> {
  @Query("select m from MarketEntity m where m.status = :status order by m.volume desc")
  List<MarketEntity> findActive(@Param("status") MarketStatus status, Pageable pageable);
}
```

## Service Layer with Transactions

```java
@Service
public class MarketService {
  private final MarketRepository repo;

  public MarketService(MarketRepository repo) {
    this.repo = repo;
  }

  @Transactional
  public Market create(CreateMarketRequest request) {
    MarketEntity entity = MarketEntity.from(request);
    MarketEntity saved = repo.save(entity);
    return Market.from(saved);
  }
}
```

## DTOs and Validation

```java
public record CreateMarketRequest(
    @NotBlank @Size(max = 200) String name,
    @NotBlank @Size(max = 2000) String description,
    @NotNull @FutureOrPresent Instant endDate,
    @NotEmpty List<@NotBlank String> categories) {}

public record MarketResponse(Long id, String name, MarketStatus status) {
  static MarketResponse from(Market market) {
    return new MarketResponse(market.id(), market.name(), market.status());
  }
}
```

## Exception Handling

```java
@ControllerAdvice
class GlobalExceptionHandler {
  @ExceptionHandler(MethodArgumentNotValidException.class)
  ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex) {
    String message = ex.getBindingResult().getFieldErrors().stream()
        .map(e -> e.getField() + ": " + e.getDefaultMessage())
        .collect(Collectors.joining(", "));
    return ResponseEntity.badRequest().body(ApiError.validation(message));
  }

  @ExceptionHandler(AccessDeniedException.class)
  ResponseEntity<ApiError> handleAccessDenied() {
    return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ApiError.of("Forbidden"));
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<ApiError> handleGeneric(Exception ex) {
    // Log unexpected errors with stack traces
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(ApiError.of("Internal server error"));
  }
}
```

## Caching

Requires `@EnableCaching` on a configuration class.

```java
@Service
public class MarketCacheService {
  private final MarketRepository repo;

  public MarketCacheService(MarketRepository repo) {
    this.repo = repo;
  }

  @Cacheable(value = "market", key = "#id")
  public Market getById(Long id) {
    return repo.findById(id)
        .map(Market::from)
        .orElseThrow(() -> new EntityNotFoundException("Market not found"));
  }

  @CacheEvict(value = "market", key = "#id")
  public void evict(Long id) {}
}
```

## Async Processing

Requires `@EnableAsync` on a configuration class.

```java
@Service
public class NotificationService {
  @Async
  public CompletableFuture<Void> sendAsync(Notification notification) {
    // send email/SMS
    return CompletableFuture.completedFuture(null);
  }
}
```

## Logging (SLF4J)

```java
@Service
public class ReportService {
  private static final Logger log = LoggerFactory.getLogger(ReportService.class);

  public Report generate(Long marketId) {
    log.info("generate_report marketId={}", marketId);
    try {
      // logic
    } catch (Exception ex) {
      log.error("generate_report_failed marketId={}", marketId, ex);
      throw ex;
    }
    return new Report();
  }
}
```

## Middleware / Filters

```java
@Component
public class RequestLoggingFilter extends OncePerRequestFilter {
  private static final Logger log = LoggerFactory.getLogger(RequestLoggingFilter.class);

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
      FilterChain filterChain) throws ServletException, IOException {
    long start = System.currentTimeMillis();
    try {
      filterChain.doFilter(request, response);
    } finally {
      long duration = System.currentTimeMillis() - start;
      log.info("req method={} uri={} status={} durationMs={}",
          request.getMethod(), request.getRequestURI(), response.getStatus(), duration);
    }
  }
}
```

## Pagination and Sorting

```java
PageRequest page = PageRequest.of(pageNumber, pageSize, Sort.by("createdAt").descending());
Page<Market> results = marketService.list(page);
```

## Error-Resilient External Calls

```java
public <T> T withRetry(Supplier<T> supplier, int maxRetries) {
  int attempts = 0;
  while (true) {
    try {
      return supplier.get();
    } catch (Exception ex) {
      attempts++;
      if (attempts >= maxRetries) {
        throw ex;
      }
      try {
        Thread.sleep((long) Math.pow(2, attempts) * 100L);
      } catch (InterruptedException ie) {
        Thread.currentThread().interrupt();
        throw ex;
      }
    }
  }
}
```

## Production-Safe Defaults

- Keep controller logic thin and move business logic into services.
- Use request/response DTOs instead of exposing persistence entities directly.
- Apply validation annotations at the DTO boundary.
- Centralize exception handling with `@ControllerAdvice`.
- Use transactions intentionally at the service layer.
- Add logging and basic observability for important operations.
- Prefer explicit pagination, sorting, and filtering contracts.
- Preserve backward compatibility for API changes unless the task explicitly requires a breaking contract change.
