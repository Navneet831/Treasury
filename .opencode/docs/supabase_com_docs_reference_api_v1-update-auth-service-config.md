# Management API Reference | Supabase Docs

> Source: https://supabase.com/docs/reference/api/v1-update-auth-service-config
> Cached: 2026-07-20T12:47:24.219Z

---

# Management API

Manage your Supabase organizations and projects programmatically.

## Authentication[#](#authentication)

All API requests require an access token to be included in the Authorization header: `Authorization Bearer <access_token>`.

There are two ways to generate an access token:

**Personal access token (PAT):**
PATs are long-lived tokens that you manually generate to access the Management API. They are useful for automating workflows or developing against the Management API. PATs carry the same privileges as your user account, so be sure to keep it secret.
To generate or manage your personal access tokens, visit your [account](/dashboard/account/tokens) page.

**OAuth2:**
OAuth2 allows your application to generate tokens on behalf of a Supabase user, providing secure and limited access to their account without requiring their credentials. Use this if you&#x27;re building a third-party app that needs to create or manage Supabase projects on behalf of your users. Tokens generated via OAuth2 are short-lived and tied to specific scopes to ensure your app can only perform actions that are explicitly approved by the user.
See [Build a Supabase Integration](/docs/guides/integrations/build-a-supabase-integration) to set up OAuth2 for your application.

```
1curl https://api.supabase.com/v1/projects \2  -H "Authorization: Bearer sbp_bdd0••••••••••••••••••••••••••••••••4f23"
```

All API requests must be authenticated and made over HTTPS.

## Rate limits[#](#rate-limits)

Rate limits are applied to prevent abuse and ensure fair usage of the Management API. Rate limits are based on a per-user, per-scope model, meaning each user gets independent rate limits for each project and organization they interact with.

### Standard rate limit[#](#standard-rate-limit)

LimitDurationScope120 requests1 minutePer user, per project/organizationWhen you exceed this rate limit, all subsequent API calls will return a `429 Too Many Requests` response for the remainder of the minute. Once the time window expires, your request quota resets and you can make requests again.

### Rate limit scope[#](#rate-limit-scope)

Rate limits are applied with per-user + per-scope isolation:

- **Project scope**: Rate limits apply independently to each project. Requests to one project do not count toward the limit of another project.

- **Organization scope**: Rate limits apply independently to each organization. Requests to one organization do not count toward the limit of another organization.

This means you can make 120 requests to Project A and 120 requests to Project B within the same minute without hitting rate limits, as they are tracked separately.

### Rate limit response headers[#](#rate-limit-response-headers)

Every API response includes rate limit information following official [HTTP specification headers](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-ratelimit-headers):

- `X-RateLimit-Limit` - The maximum number of requests allowed in the current time window

- `X-RateLimit-Remaining` - The number of requests remaining before you hit the rate limit

- `X-RateLimit-Reset` - The number of seconds remaining until your rate limit resets

You can use these headers to monitor your usage and implement proactive rate limit handling before receiving a 429 response.

### How rate limits are tracked[#](#how-rate-limits-are-tracked)

Your requests are identified and tracked using one of the following identifiers, in this order of priority:

- **OAuth App ID** - If your request is authenticated via an OAuth application

- **User ID** - If your request is authenticated with a personal access token

- **IP Address** - If your request is unauthenticated (extracted from request headers)

Each identifier is combined with the scope (project or organization) to create a unique tracking key. This ensures that rate limits are isolated per user and per scope, preventing one project or organization from affecting another.

### Endpoint exceptions[#](#endpoint-exceptions)

Some endpoints have stricter rate limits than the standard 120 requests per minute to prevent abuse of resource-intensive operations:

EndpointLimitDurationReason`GET /v1/projects/:ref/endpoints/logs.all`30 requests1 minuteAnalytics log queries are computationally expensive`GET /v1/projects/:ref/endpoints/usage.api-counts`30 requests1 minuteAnalytics aggregation is computationally expensive`GET /v1/projects/:ref/endpoints/usage.api-requests-count`30 requests1 minuteAnalytics aggregation is computationally expensive`GET /v1/projects/:ref/database/context`10 requests1 minuteDatabase context operations are resource-intensive`GET /v1/projects/:ref/database/context`1 request1 secondBurst limit to prevent rapid successive requests`POST /v1/projects/:ref/config/custom-hostname/initialize`10 requests1 minuteThese operations are expensive`POST /v1/projects/:ref/config/custom-hostname/reverify`10 requests1 minuteThese operations are expensive`DELETE /v1/projects/:ref/config/custom-hostname`10 requests1 minuteThese operations are expensive`GET /v1/projects/:ref/config/vanity-subdomain`10 requests1 minuteThese operations are expensive**Note:** The `GET /v1/projects/:ref/database/context` endpoint has dual rate limiting. You can make up to 10 requests per minute, but also no more than 1 request per second to prevent burst traffic.

Some endpoints have the standard 120 requests per minute but with different timeout durations:

EndpointLimitDurationReason`POST /v1/projects/:ref/database/migrations`120 requests3 minutesDatabase migrations may require more processing time### Best practices[#](#best-practices)

- **Monitor rate limit headers** - Check the `X-RateLimit-Remaining` header to see how many requests you have left. When it approaches 0, slow down your requests to avoid hitting the limit.

- **Implement exponential backoff** - When you receive a 429 response, wait before retrying. You can use the `X-RateLimit-Reset` header (seconds) to determine exactly how long to wait.

- **Batch operations** - Where possible, combine multiple operations into fewer API calls to reduce your request count.

- **Be mindful of expensive endpoints** - Analytics, database context, and domain endpoints have stricter limits, so use them judiciously.

The Management API is subject to our fair-use policy. All resources created via the API are subject to the pricing detailed on our [Pricing](https://supabase.com/pricing) pages.

Additional links

- [OpenAPI Docs](https://api.supabase.com/api/v1)

- [OpenAPI Spec](https://api.supabase.com/api/v1-json)

- [Report bugs and issues](https://github.com/supabase/supabase)

## Gets project performance advisors.deprecated

get`/v1/projects/{ref}/advisors/performance`This is an **experimental** endpoint. It is subject to change or removal in future versions. Use it with caution, as it may not remain supported or stable.

### OAuth scopes

- database:read

### The fine-grained token must include the following permissions to access this endpoint:

- advisors_read

### Path parameters

refRequiredstringProject ref

Details
### Response codes

- 200
- 401
- 403
- 429

### Response (200)

exampleschema```
1{2  "lints": [3    {4      "name": "unindexed_foreign_keys",5      "title": "lorem",6      "level": "ERROR",7      "facing": "EXTERNAL",8      "categories": [9        "PERFORMANCE"10      ],11      "description": "lorem",12      "detail": "lorem",13      "remediation": "lorem",14      "metadata": {15        "schema": "lorem",16        "name": "lorem",17        "entity": "lorem",18        "type": "table",19        "fkey_name": "lorem",20        "fkey_columns": [21          4222        ]23      },24      "cache_key": "lorem"25    }26  ]27}
```

## Gets project security advisors.deprecated

get`/v1/projects/{ref}/advisors/security`This is an **experimental** endpoint. It is subject to change or removal in future versions. Use it with caution, as it may not remain supported or stable.

### OAuth scopes

- database:read

### The fine-grained token must include the following permissions to access this endpoint:

- advisors_read

### Path parameters

refRequiredstringProject ref

Details
### Query parameters

- lint_typeOptionalenumAccepted values

### Response codes

- 200
- 401
- 403
- 429

### Response (200)

exampleschema```
1{2  "lints": [3    {4      "name": "unindexed_foreign_keys",5      "title": "lorem",6      "level": "ERROR",7      "facing": "EXTERNAL",8      "categories": [9        "PERFORMANCE"10      ],11      "description": "lorem",12      "detail": "lorem",13      "remediation": "lorem",14      "metadata": {15        "schema": "lorem",16        "name": "lorem",17        "entity": "lorem",18        "type": "table",19        "fkey_name": "lorem",20        "fkey_columns": [21          4222        ]23      },24      "cache_key": "lorem"25    }26  ]27}
```

## Create a log drain for a project

post`/v2/projects/{ref}/analytics/log-drains`### OAuth scopes

- analytics_config:write

### This endpoint is only available on the following plans:

- Pro
- Team
- Enterprise

### The fine-grained token must include the following permissions to access this endpoint:

- analytics_config_write

### Path parameters

refRequiredstringProject ref

Details
### Body

- dataRequiredobjectObject schema

### Response codes

- 201
- 401
- 402
- 403
- 429
- 500

### Response (201)

exampleschema```
1{2  "data": {3    "type": "log_drain",4    "id": "lorem",5    "attributes": {6      "name": "lorem",7      "description": "lorem",8      "config": {9        "url": "lorem",10        "schema": "lorem",11        "username": "lorem",12        "password": "lorem",13        "port": 42,14        "hostname": "lorem"15      },16      "backend_type": "postgres"17    }18  }19}
```

## Delete a project log drain

delete`/v2/projects/{ref}/analytics/log-drains/{id}`### OAuth scopes

- analytics_config:write

### The fine-grained token must include the following permissions to access this endpoint:

- analytics_config_write

### Path parameters

refRequiredstringProject ref

DetailsidRequiredstringLog drains identifier

### Response codes

- 204
- 401
- 403
- 429
- 500

### Response (204)

schema```
1{}
```

## Gets a project&#x27;s function combined statistics

get`/v1/projects/{ref}/analytics/endpoints/functions.combined-stats`### The fine-grained token must include the following permissions to access this endpoint:

- analytics_usage_read

### Path parameters

refRequiredstringProject ref

Details
### Query parameters

- intervalRequiredenumAccepted values
- function_idRequiredstring

### Response codes

- 200
- 401
- 403
- 429
- 500

### Response (200)

exampleschema```
1{2  "result": [3    null4  ],5  "error": "lorem"6}
```

## Gets all project&#x27;s logs in a single log stream

get`/v1/projects/{ref}/analytics/endpoints/logs`Executes an SQL or LQL query on the project&#x27;s unified logs stream.

Either the `iso_timestamp_start` and `iso_timestamp_end` parameters must be provided.
If both are not provided, only the last 1 minute of logs will be queried.
The timestamp range must be no more than 24 hours and is rounded to the nearest minute. If the range is more than 24 hours, a validation error will be thrown.
Filter by the `source` column to specify specific log sources, such as edge_logs, postgres_logs, etc.

Note: SQL must be written in **ClickHouse SQL dialect**.

### OAuth scopes

- analytics:read

### The fine-grained token must include the following permissions to access this endpoint:

- analytics_logs_read

### Path parameters

refRequiredstringProject ref

Details
### Query parameters

sqlOptionalstringCustom SQL query to execute on the logs. See [querying logs](/docs/guides/telemetry/logs?queryGroups=product&product=postgres&queryGroups=source&source=edge_logs#querying-with-the-logs-explorer) for more details.

- iso_timestamp_startOptionalstring
- iso_timestamp_endOptionalstring

### Response codes

- 200
- 401
- 402
- 403
- 429

### Response (200)

exampleschema```
1{2  "result": [3    null4  ],5  "error": "lorem"6}
```

## Gets project&#x27;s logsdeprecated

get`/v1/projects/{ref}/analytics/endpoints/logs.all`Executes a SQL query on the project&#x27;s logs.

Either the `iso_timestamp_start` and `iso_timestamp_end` parameters must be provided.
If both are not provided, only the last 1 minute of logs will be queried.
The timestamp range must be no more than 24 hours and is rounded to the nearest minute. If the range is more than 24 hours, a validation error will be thrown.
Note: Unless the `sql` parameter is provided, only edge_logs will be queried. See the [log query docs](/docs/guides/telemetry/logs?queryGroups=product&product=postgres&queryGroups=source&source=edge_logs#querying-with-the-logs-explorer:~:text=logs%20from%20the-,Sources,-drop%2Ddown%3A) for all available sources.

### OAuth scopes

- analytics:read

### The fine-grained token must include the following permissions to access this endpoint:

- analytics_logs_read

### Path parameters

refRequiredstringProject ref

Details
### Query parameters

sqlOptionalstringCustom SQL query to execute on the logs. See [querying logs](/docs/guides/telemetry/logs?queryGroups=product&product=postgres&queryGroups=source&source=edge_logs#querying-with-the-logs-explorer) for more details.

- iso_timestamp_startOptionalstring
- iso_timestamp_endOptionalstring

### Response codes

- 200
- 401
- 402
- 403
- 429

### Response (200)

exampleschema```
1{2  "result": [3    null4  ],5  "error": "lorem"6}
```

## Gets project&#x27;s usage api counts

get`/v1/projects/{ref}/analytics/endpoints/usage.api-counts`### The fine-grained token must include the following permissions to access this endpoint:

- analytics_usage_read

### Path parameters

refRequiredstringProject ref

Details
### Query parameters

- intervalOptionalenumAccepted values

### Response codes

- 200
- 401
- 403
- 429
- 500

### Response (200)

exampleschema```
1{2  "result": [3    {4      "timestamp": "2021-12-31T23:34:00Z",5      "total_auth_requests": 42,6      "total_realtime_requests": 42,7      "total_rest_requests": 42,8      "total_storage_requests": 429    }10  ],11  "error": "lorem"12}
```

## Gets project&#x27;s usage api requests count

get`/v1/projects/{ref}/analytics/endpoints/usage.api-requests-count`### The fine-grained token must include the following permissions to access this endpoint:

- analytics_usage_read

### Path parameters

refRequiredstringProject ref

Details
### Response codes

- 200
- 401
- 403
- 429
- 500

### Response (200)

exampleschema```
1{2  "result": [3    {4      "count": 425    }6  ],7  "error": "lorem"8}
```

## List project log drains

get`/v2/projects/{ref}/analytics/log-drains`### OAuth scopes

- analytics_config:read

### The fine-grained token must include the following permissions to access this endpoint:

- analytics_config_read

### Path parameters

refRequiredstringProject ref

Details
### Response codes

- 200
- 401
- 403
- 429
- 

... [Content truncated]