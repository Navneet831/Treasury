# JavaScript API Reference | Supabase Docs

> Source: https://supabase.com/docs/reference/javascript/auth-signinwithotp
> Cached: 2026-07-20T12:33:03.623Z

---

# JavaScript Client Library

@supabase/supabase-js[View on GitHub](https://github.com/supabase/supabase-js)This reference documents every object and method available in Supabase&#x27;s isomorphic JavaScript library, `supabase-js`. You can use `supabase-js` to interact with your Postgres database, listen to database changes, invoke Deno Edge Functions, build login and user management functionality, and manage large files.

To convert SQL queries to `supabase-js` calls, use the [SQL to REST API translator](/docs/guides/api/sql-to-rest).

Using `supabase-js` on the server? See [which package to use](/docs/guides/auth/choosing-a-server-package) to decide between `supabase-js`, `@supabase/ssr`, and `@supabase/server`.

## Installing

### Install as package[#](#install-as-package)

You can install @supabase/supabase-js via the terminal.

npmYarnpnpm```
1npm install @supabase/supabase-js
```

### Install via CDN[#](#install-via-cdn)

You can install @supabase/supabase-js via CDN links.

```
1<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>2//or3<script src="https://unpkg.com/@supabase/supabase-js@2"></script>
```

### Use at runtime in Deno[#](#use-at-runtime-in-deno)

You can use supabase-js in the Deno runtime via [JSR](https://jsr.io/@supabase/supabase-js):

```
1import { createClient } from &#x27;npm:@supabase/supabase-js@2&#x27;
```

### Enable Data API access[#](#enable-data-api-access)

supabase-js uses the Data API to query and mutate your Postgres data. You first need to grant Data API roles permissions to access your tables and functions.

In [Data API integrations settings](/dashboard/project/_/integrations/data_api/settings), expose the specific tables and functions you want to access. To automatically grant access for new tables and functions in `public`, enable **Default privileges for new entities**.

Alternatively, use SQL to grant the required permissions:

```
1-- Before granting access to client roles, make sure RLS is enabled2-- and create the policies required for each role&#x27;s allowed operations.3alter table public.your_table enable row level security;4-- create policy ... on public.your_table ...;56-- Grant least-privilege access to tables after RLS and policies are in place7grant select on public.your_table to anon;8grant select, insert, update, delete on public.your_table to authenticated;9grant all on public.your_table to service_role;1011-- Grant execute on functions after verifying any table access they rely on12grant execute on function public.your_function to authenticated, service_role;
```

## Initializing

Create a new client for use in the browser.

### Parameters

supabaseUrlstringThe unique Supabase URL which is supplied when you create a new project in your project dashboard.

supabaseKeystringThe unique Supabase Key which is supplied when you create a new project in your project dashboard.

optionsOptionalSupabaseClientOptionsOptional configuration for the client:

- `db.schema` — You can switch in between schemas. The schema needs to be on the list of exposed schemas inside Supabase.

- `auth.autoRefreshToken` — Set to `true` if you want to automatically refresh the token before expiring.

- `auth.persistSession` — Set to `true` if you want to automatically save the user session into local storage.

- `auth.detectSessionInUrl` — Set to `true` if you want to automatically detect OAuth grants in the URL and sign in the user.

- `realtime` — Options passed along to the realtime-js constructor.

- `storage` — Options passed along to the storage-js constructor.

- `global.fetch` — A custom fetch implementation.

- `global.headers` — Any additional headers to send with each network request.

Details
Creating a clientWith a custom domainWith additional parametersWith custom schemasCustom fetch implementationReact Native options with AsyncStorageReact Native options with Expo SecureStoreWith a database queryWith OpenTelemetry tracing```
1import { createClient } from &#x27;@supabase/supabase-js&#x27;23// Create a single supabase client for interacting with your database4const supabase = createClient(&#x27;https://xyzcompany.supabase.co&#x27;, &#x27;your-publishable-key&#x27;)
```

## TypeScript support

`supabase-js` has TypeScript support for type inference, autocompletion, type-safe queries, and more.

With TypeScript, `supabase-js` detects things like `not null` constraints and [generated columns](https://www.postgresql.org/docs/current/ddl-generated-columns.html). Nullable columns are typed as `T | null` when you select the column. Generated columns will show a type error when you insert to it.

`supabase-js` also detects relationships between tables. A referenced table with one-to-many relationship is typed as `T[]`. Likewise, a referenced table with many-to-one relationship is typed as `T | null`.

## Generating TypeScript Types[#](#generating-typescript-types)

You can use the Supabase CLI to [generate the types](/docs/reference/cli/supabase-gen-types). You can also generate the types [from the dashboard](https://supabase.com/dashboard/project/_/api?page=tables-intro).

```
1supabase gen types typescript --project-id abcdefghijklmnopqrst > database.types.ts
```

These types are generated from your database schema. Given a table `public.movies`, the generated types will look like:

```
1create table public.movies (2  id bigint generated always as identity primary key,3  name text not null,4  data jsonb null5);
```

```
1export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]23export interface Database {4  public: {5    Tables: {6      movies: {7        Row: {               // the data expected from .select()8          id: number9          name: string10          data: Json | null11        }12        Insert: {            // the data to be passed to .insert()13          id?: never         // generated columns must not be supplied14          name: string       // `not null` columns with no default must be supplied15          data?: Json | null // nullable columns can be omitted16        }17        Update: {            // the data to be passed to .update()18          id?: never19          name?: string      // `not null` columns are optional on .update()20          data?: Json | null21        }22      }23    }24  }25}
```

## Using TypeScript type definitions[#](#using-typescript-type-definitions)

You can supply the type definitions to `supabase-js` like so:

```
1import { createClient } from &#x27;@supabase/supabase-js&#x27;2import { Database } from &#x27;./database.types&#x27;34const supabase = createClient<Database>(5  process.env.SUPABASE_URL,6  process.env.SUPABASE_PUBLISHABLE_KEY7)
```

## Helper types for Tables and Joins[#](#helper-types-for-tables-and-joins)

You can use the following helper types to make the generated TypeScript types easier to use.

Sometimes the generated types are not what you expect. For example, a view&#x27;s column may show up as nullable when you expect it to be `not null`. Using [type-fest](https://github.com/sindresorhus/type-fest), you can override the types like so:

```
1export type Json = // ...23export interface Database {4  // ...5}
```

```
1import { MergeDeep } from &#x27;type-fest&#x27;2import { Database as DatabaseGenerated } from &#x27;./database-generated.types&#x27;3export { Json } from &#x27;./database-generated.types&#x27;45// Override the type for a specific column in a view:6export type Database = MergeDeep<7  DatabaseGenerated,8  {9    public: {10      Views: {11        movies_view: {12          Row: {13            // id is a primary key in public.movies, so it must be `not null`14            id: number15          }16        }17      }18    }19  }20>
```

You can also override the type of an individual successful response if needed:

```
1// Partial type override allows you to only override some of the properties in your results2const { data } = await supabase.from(&#x27;countries&#x27;).select().overrideTypes<Array<{ id: string }>>()3// For a full replacement of the original return type use the `{ merge: false }` property as second argument4const { data } = await supabase5  .from(&#x27;countries&#x27;)6  .select()7  .overrideTypes<Array<{ id: string }>, { merge: false }>()8// Use it with `maybeSingle` or `single`9const { data } = await supabase.from(&#x27;countries&#x27;).select().single().overrideTypes<{ id: string }>()
```

The generated types provide shorthands for accessing tables and enums.

```
1import { Database, Tables, Enums } from "./database.types.ts";23// Before 😕4let movie: Database[&#x27;public&#x27;][&#x27;Tables&#x27;][&#x27;movies&#x27;][&#x27;Row&#x27;] = // ...56// After 😍7let movie: Tables<&#x27;movies&#x27;>
```

### Response types for complex queries[#](#response-types-for-complex-queries)

`supabase-js` always returns a `data` object (for success), and an `error` object (for unsuccessful requests).

These helper types provide the result types from any query, including nested types for database joins.

Given the following schema with a relation between cities and countries, we can get the nested `CountriesWithCities` type:

```
1create table countries (2  "id" serial primary key,3  "name" text4);56create table cities (7  "id" serial primary key,8  "name" text,9  "country_id" int references "countries"10);
```

```
1import { QueryResult, QueryData, QueryError } from &#x27;@supabase/supabase-js&#x27;23const countriesWithCitiesQuery = supabase4  .from("countries")5  .select(`6    id,7    name,8    cities (9      id,10      name11    )12  `);13type CountriesWithCities = QueryData<typeof countriesWithCitiesQuery>;1415const { data, error } = await countriesWithCitiesQuery;16if (error) throw error;17const countriesWithCities: CountriesWithCities = data;
```

## delete

`delete(options)`Perform a DELETE on the table or view.

By default, deleted rows are not returned. To return it, chain the call with `.select()` after filters.

- `delete()` should always be combined with [filters](/docs/reference/javascript/using-filters) to target the item(s) you wish to delete.

- If you use `delete()` with filters and you have [RLS](/docs/learn/auth-deep-dive/auth-row-level-security) enabled, only rows visible through `SELECT` policies are deleted. Note that by default no rows are visible, so you need at least one `SELECT`/`ALL` policy that makes the rows visible.

- When using `delete().in()`, specify an array of values to target multiple rows with a single query. This is particularly useful for batch deleting entries that share common criteria, such as deleting users by their IDs. Ensure that the array you provide accurately represents all records you intend to delete to avoid unintended data removal.

### Parameters

optionsobjectNamed parameters

Details
Delete a single recordHandling errorsDelete a record and return itDelete multiple records```
1const response = await supabase2  .from(&#x27;countries&#x27;)3  .delete()4  .eq(&#x27;id&#x27;, 1)
```

Data sourceResponse## from

`from(relation)`Perform a query on a table or a view.

### Parameters

relationOne of the following optionsThe table or view name to query

Details
- Option 1TableName
- Option 2ViewName

## insert

`insert(values, options)`Perform an INSERT into the table or view.

By default, inserted rows are not returned. To return it, chain the call with `.select()`.

### Parameters

valuesOne of the following optionsThe values to insert. Pass an object to insert a single row or an array to insert multiple rows.

Details
- Option 1RejectExcessProperties
- Option 2Array<RejectExcessProperties>

optionsobjectNamed parameters

Details
Create a recordHandling errorsCreate a record and return itBulk create```
1const { error } = await supabase2  .from(&#x27;countries&#x27;)3  .insert({ id: 1, name: &#x27;Mordor&#x27; })
```

Data sourceResponse## rpc

`rpc(fn, args, options)`Perform a function call.

### Parameters

fnFnNameThe function name to call

argsArgsThe arguments to pass to the function call

optionsobjectNamed parameters

Details
Example 1Call a Postgres function without argumentsCall a Postgres function with argumentsBulk processingCall a Postgres function with filtersCall a read-only Postgres function```
1// For cross-schema functions where type inference fails, use overrideTypes:2const { data } = await supabase3  .schema(&#x27;schema_b&#x27;)4  .rpc(&#x27;function_a&#x27;, {})5  .overrideTypes<{ id: string; user_id: string }[]>()
```

## schema

`schema(schema)`Select a schema to query or perform an function (rpc) call.

The schema needs to be on the list of exposed schemas inside Supabase.

### Parameters

schemaDynamicSchemaThe schema to query

## select

`select(columns?, options?)`Perform a SELECT query on the table or view.

When using `count` with `.range()` or `.limit()`, the returned `count` is the total number of rows that match your filters, not the number of rows in the current page. Use this to build pagination UI.

- By default, Supabase projects return a maximum of 1,000 rows. This setting can be changed in your project&#x27;s [API settings](/dashboard/project/_/settings/api). It&#x27;s recommended that you keep it low to limit the payload size of accidental or malicious requests. You can use `range()` queries to paginate through your data.

- `select()` can be combined with [Filters](/docs/reference/javascript/using-filters)

- `select()` can be combined with [Modifiers](/docs/reference/javascript/using-modifiers)

- `apikey` is a reserved keyword if you&#x27;re using the [Supabase Platform](/docs/guides/platform) and [should be avoided as a column name](https://github.com/supabase/supabase/issues/5465). *

### Parameters

columnsOptionalQueryThe columns to retrieve, separated by commas. Columns can be renamed when returned with `customName:columnName`

optionsOptionalobjectNamed parameters

Details
Getting your dataHandling errorsSelecting specific columnsQuery referenced tablesQuery referenced tables with spaces in their namesQuery referenced tables through a join tableQuery the same referenced table multiple timesFiltering through referenced tablesQuerying referenced table with countQuerying with count optionQuerying JSON dataQuerying referenced table with inner joinSwitching schemas per query```
1const { data, error } = await supabase2  .from(&#x27;characters&#x27;)3  .select()
```

Data sourceResponse## update

`update(values, options)`Perform an UPDATE on the table or view.

By default, updated rows are not returned. To return it, chain the call with `.select()` after filters.

- `update()` should always be combined with [Filters](/docs/reference/javascript/using-filters) to target the item(s) you wish to update.

### Parameters

valuesRejectExcessPropertiesThe values to update with

optionsobjectNamed parameters

Details
Updating your dataHandling errorsUpdate a record and return itUpdating JSON data```
1const { error } = await supabase2  .from(&#x27;instruments&

... [Content truncated]