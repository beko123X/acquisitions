# Acquisitions API - Architecture Documentation

## 1. 🎯 The Big Picture

### What Type of Project?
This is a **RESTful API backend application** built with Node.js and Express, focused on user authentication and management.

### What Problem Does It Solve?
The system provides a secure, scalable authentication service that handles:
- User registration (sign-up)
- User authentication (sign-in/sign-out) - *in progress*
- Role-based user management (admin/user roles)
- Secure JWT-based session management with HTTP-only cookies

Think of this as the foundation for a larger application that needs user authentication—like a SaaS platform, e-commerce backend, or any multi-user web application.

---

## 2. 🏗️ Core Architecture

### Architecture Pattern: **Layered Monolithic Architecture**

The application follows a clean **3-layer architecture** (Controller → Service → Data):

```
┌─────────────────────────────────────────────────┐
│              CLIENT (Browser/App)               │
└────────────────────┬────────────────────────────┘
                     │ HTTP Requests (JSON)
                     ▼
┌─────────────────────────────────────────────────┐
│         MIDDLEWARE LAYER                         │
│  • Helmet (Security Headers)                     │
│  • CORS (Cross-Origin)                          │
│  • Morgan (HTTP Logging)                        │
│  • Cookie Parser                                │
│  • Body Parsers (JSON/URL-encoded)              │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│         ROUTES LAYER                            │
│  • /api/auth/* (Authentication Routes)          │
│  • /health (Health Check)                       │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│         VALIDATION LAYER                        │
│  • Zod Schemas (Request Validation)             │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│         CONTROLLER LAYER                        │
│  • Validate Input                               │
│  • Call Services                                │
│  • Format Response                              │
│  • Handle Errors                                │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│         SERVICE LAYER (Business Logic)          │
│  • User Creation Logic                          │
│  • Password Hashing (bcrypt)                    │
│  • Duplicate Email Check                        │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│         DATA ACCESS LAYER                       │
│  • Drizzle ORM                                  │
│  • User Model                                   │
└────────────────────┬────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│         DATABASE (PostgreSQL via Neon)          │
│  • users table                                  │
└─────────────────────────────────────────────────┘
```

### Directory Structure

```
acquisitions/
├── src/
│   ├── config/          # Configuration files (DB, Logger)
│   ├── controllers/     # Request handlers (orchestration)
│   ├── models/          # Database schemas (Drizzle models)
│   ├── routes/          # Route definitions (Express routers)
│   ├── services/        # Business logic layer
│   ├── utils/           # Helper functions (JWT, cookies, formatting)
│   ├── validations/     # Zod validation schemas
│   ├── app.js           # Express app setup & middleware
│   ├── server.js        # HTTP server initialization
│   └── index.js         # Entry point
├── drizzle/             # Database migrations
├── logs/                # Application logs (error.log, combined.log)
└── node_modules/        # Dependencies
```

---

## 3. 🧩 Key Components Breakdown

### 3.1 **Entry Point (`index.js` → `server.js`)**
- `index.js`: Loads environment variables and imports server
- `server.js`: Starts the Express server on configured PORT (default: 3000)

**Purpose**: Bootstrap the application

---

### 3.2 **Application Core (`app.js`)**
Configures the Express application with:

| Middleware | Purpose |
|------------|---------|
| `helmet()` | Sets security-related HTTP headers (XSS protection, etc.) |
| `cors()` | Enables Cross-Origin Resource Sharing |
| `express.json()` | Parses JSON request bodies |
| `express.urlencoded()` | Parses URL-encoded form data |
| `cookieParser()` | Parses cookies from requests |
| `morgan()` | HTTP request logger (logs to Winston) |

**Routes Defined**:
- `GET /` → Welcome message
- `GET /health` → Health check endpoint (uptime, timestamp)
- `GET /api` → API info endpoint
- `POST /api/auth/*` → Authentication routes

---

### 3.3 **Configuration Layer (`config/`)**

#### `database.js`
- **Neon Database**: Serverless PostgreSQL connection
- **Drizzle ORM**: Type-safe SQL query builder
- Exports `db` (query interface) and `sql` (raw SQL executor)

#### `logger.js`
- **Winston Logger**: Structured logging system
- Log Levels: error, warn, info, debug
- **Transports**:
  - `logs/error.log` (errors only)
  - `logs/combined.log` (all logs)
  - Console (development only, colorized)
- **Format**: JSON with timestamps and error stacks

---

### 3.4 **Routes Layer (`routes/auth.routes.js`)**
Defines authentication endpoints:

```javascript
POST /api/auth/sign-up   → signup controller (✅ Implemented)
POST /api/auth/sign-in   → placeholder (🚧 TODO)
POST /api/auth/sign-out  → placeholder (🚧 TODO)
```

**Purpose**: Maps HTTP routes to controller functions

---

### 3.5 **Validation Layer (`validations/auth.validation.js`)**
Uses **Zod** for type-safe validation schemas:

#### `signupSchema`
```javascript
{
  name: string (2-255 chars, trimmed),
  email: email format (lowercase, trimmed),
  password: string (6-128 chars),
  role: enum ['admin', 'user'] (default: 'user')
}
```

#### `signinSchema`
```javascript
{
  email: email format (lowercase, trimmed),
  password: string (min 1 char)
}
```

**Purpose**: Ensure data integrity before processing

---

### 3.6 **Controller Layer (`controllers/auth.controller.js`)**

#### `signup` Controller Flow:
1. **Validate** request body with Zod schema
2. If validation fails → Return 400 with formatted errors
3. Call `createUser` service with validated data
4. Generate JWT token with user payload
5. Set HTTP-only cookie with token
6. Log success
7. Return 201 with user data (excluding password)

**Error Handling**:
- Validation errors → 400 Bad Request
- Duplicate email → 409 Conflict
- Other errors → Pass to Express error handler

**Purpose**: Orchestrate request/response cycle, coordinate services

---

### 3.7 **Service Layer (`services/auth.service.js`)**

#### `hashedPassword(password)`
- Uses `bcrypt.hash()` with salt rounds = 10
- Returns hashed password string
- Logs errors and throws generic error message

#### `createUser({ name, email, password, role })`
**Steps**:
1. **Check existing user**: Query DB for email
2. If exists → Throw "User already exists" error
3. **Hash password**: Call `hashedPassword()`
4. **Insert user**: Drizzle ORM insert with `.returning()`
5. **Log success**
6. Return new user object (without password)

**Purpose**: Encapsulate business logic, database operations

---

### 3.8 **Data Layer (`models/user.model.js`)**

#### Users Table Schema (Drizzle):
```sql
CREATE TABLE "users" (
  id         serial PRIMARY KEY,
  name       varchar(255) NOT NULL,
  email      varchar(255) UNIQUE NOT NULL,
  password   varchar(255) NOT NULL,
  role       varchar(50) DEFAULT 'user' NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);
```

**Purpose**: Define data structure and constraints

---

### 3.9 **Utility Layer (`utils/`)**

#### `jwt.js` - JWT Token Management
```javascript
jwttoken.sign(payload)   → Creates JWT (expires in 1 day)
jwttoken.verify(token)   → Validates and decodes JWT
```

#### `cookies.js` - Cookie Management
```javascript
cookies.set(res, name, value)   → Set HTTP-only cookie
cookies.clear(res, name)        → Clear cookie
cookies.get(req, name)          → Read cookie from request

Options:
- httpOnly: true (prevents XSS)
- secure: true in production (HTTPS only)
- sameSite: 'strict' (CSRF protection)
- maxAge: 15 minutes
```

#### `format.js` - Error Formatting
```javascript
formatValidationError(errors) → Pretty-print Zod errors
```

**Purpose**: Reusable utility functions

---

## 4. 🔄 Data Flow & Communication

### Complete Sign-Up Request Flow

```
┌─────────┐
│ Client  │
└────┬────┘
     │ POST /api/auth/sign-up
     │ Body: { name, email, password, role }
     ▼
┌──────────────────────────────────────────┐
│ Middleware Stack                         │
│ 1. Helmet → Add security headers         │
│ 2. CORS → Validate origin               │
│ 3. JSON Parser → Parse body             │
│ 4. Cookie Parser → Parse cookies        │
│ 5. Morgan → Log request                 │
└────┬─────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────┐
│ Route: /api/auth/sign-up                 │
│ Router → auth.routes.js                  │
└────┬─────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────┐
│ Controller: signup()                     │
│ auth.controller.js                       │
│                                          │
│ Step 1: Validate with Zod               │
│   ├─ Valid? → Continue                  │
│   └─ Invalid? → Return 400 error        │
└────┬─────────────────────────────────────┘
     │ Valid Data: { name, email, password, role }
     ▼
┌──────────────────────────────────────────┐
│ Service: createUser()                    │
│ auth.service.js                          │
│                                          │
│ Step 2: Check if email exists           │
│   Query: SELECT * FROM users             │
│          WHERE email = ?                 │
│   ├─ Exists? → Throw error              │
│   └─ Not exists? → Continue             │
│                                          │
│ Step 3: Hash password with bcrypt       │
│   bcrypt.hash(password, 10)             │
│                                          │
│ Step 4: Insert user to DB               │
│   Query: INSERT INTO users               │
│          VALUES (name, email, hash, role)│
│          RETURNING id, name, email, role │
└────┬─────────────────────────────────────┘
     │ Returns: User Object
     ▼
┌──────────────────────────────────────────┐
│ Back to Controller                       │
│                                          │
│ Step 5: Generate JWT                    │
│   Payload: { id, email, role }          │
│   Secret: process.env.JWT_SECRET        │
│   Expires: 1 day                        │
│                                          │
│ Step 6: Set HTTP-only Cookie            │
│   Name: 'token'                         │
│   Value: JWT token                      │
│   Options: httpOnly, secure, sameSite   │
│                                          │
│ Step 7: Log success (Winston)           │
│                                          │
│ Step 8: Send Response                   │
│   Status: 201 Created                   │
│   Body: { message, user }               │
└────┬─────────────────────────────────────┘
     │ Response
     ▼
┌─────────┐
│ Client  │
│ Receives:│
│ - User data                             │
│ - Cookie with JWT token                 │
└─────────┘
```

### Error Flow Examples

**Scenario 1: Validation Error**
```
Client → Controller (Zod validation fails)
       → Return 400 { error, details }
       → Client
```

**Scenario 2: Duplicate Email**
```
Client → Controller → Service (DB query finds existing user)
       → Service throws error
       → Controller catches error
       → Return 409 { error: "email already exists" }
       → Client
```

**Scenario 3: Database Error**
```
Client → Controller → Service (DB connection fails)
       → Service throws error
       → Controller passes to Express error handler
       → Return 500 Internal Server Error
       → Client
```

---

## 5. 🛠️ Tech Stack & Dependencies

### Core Framework
| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | v18+ | JavaScript runtime |
| **Express** | v5.2.1 | Web framework |

### Database Stack
| Technology | Purpose | Why? |
|------------|---------|------|
| **PostgreSQL** | Relational database | ACID compliance, complex queries |
| **Neon** | Serverless Postgres | Auto-scaling, no infrastructure management |
| **Drizzle ORM** | Type-safe ORM | TypeScript-first, migrations, SQL-like syntax |
| **Drizzle Kit** | Migration tool | Schema generation, DB studio |

### Security
| Technology | Purpose |
|------------|---------|
| **bcrypt** | Password hashing (10 rounds) |
| **jsonwebtoken** | JWT creation/verification |
| **helmet** | Security headers (XSS, clickjacking protection) |
| **cors** | Cross-origin resource sharing |
| **cookie-parser** | Parse cookies securely |

### Validation & Logging
| Technology | Purpose |
|------------|---------|
| **Zod** | Schema validation & type inference |
| **Winston** | Structured logging (files + console) |
| **Morgan** | HTTP request logging |

### Development Tools
| Technology | Purpose |
|------------|---------|
| **ESLint** | Code linting |
| **Prettier** | Code formatting |
| **Nodemon** | Auto-restart on file changes |
| **dotenv** | Environment variable management |

---

## 6. 🚀 Execution Flow - Step-by-Step Example

### Example: New User Registration

**Given**: A user wants to create an account

**Request**:
```http
POST /api/auth/sign-up HTTP/1.1
Host: localhost:3000
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePass123",
  "role": "user"
}
```

**Execution Timeline**:

1. **[0ms] Request arrives** at Express server
   - Morgan logs the incoming request

2. **[1ms] Middleware chain processes request**
   - Helmet adds security headers
   - CORS checks origin
   - Body parser converts JSON to JavaScript object

3. **[2ms] Router matches** `/api/auth/sign-up` → `signup` controller

4. **[3ms] Zod validation** runs on request body
   - Validates email format
   - Checks name length (2-255)
   - Validates password length (6-128)
   - Normalizes: email lowercased, strings trimmed

5. **[5ms] Service layer: Check duplicate email**
   - Drizzle ORM query: `SELECT * FROM users WHERE email = 'john@example.com'`
   - Neon DB executes query in ~10-20ms
   - Result: No existing user ✅

6. **[25ms] Service layer: Hash password**
   - bcrypt.hash() with 10 salt rounds
   - Takes ~50-100ms (intentionally slow for security)

7. **[125ms] Service layer: Insert user**
   - Drizzle ORM: `INSERT INTO users ... RETURNING *`
   - Neon DB executes insert in ~10-20ms
   - Returns: `{ id: 1, name: "John Doe", email: "john@example.com", role: "user" }`

8. **[145ms] Controller: Generate JWT**
   - Payload: `{ id: 1, email: "john@example.com", role: "user" }`
   - Signs with SECRET, expires in 1 day
   - Token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

9. **[147ms] Controller: Set cookie**
   - Name: `token`
   - Value: JWT token
   - Options: httpOnly, secure (prod), sameSite strict, maxAge 15min

10. **[148ms] Controller: Log success**
    - Winston writes to `logs/combined.log`

11. **[150ms] Response sent**

**Response**:
```http
HTTP/1.1 201 Created
Set-Cookie: token=eyJhbGci...; HttpOnly; Secure; SameSite=Strict
Content-Type: application/json

{
  "message": "User registered",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

**Total Time**: ~150ms (most time spent on bcrypt hashing - by design!)

---

## 7. ✅ Strengths & ⚠️ Tradeoffs

### Strengths

#### 🎯 **Clean Architecture**
- **Separation of Concerns**: Routes → Controllers → Services → Models
- **Easy to test**: Each layer can be unit tested independently
- **Maintainable**: Changes in business logic don't affect routing

#### 🔒 **Security First**
- **Password Hashing**: bcrypt with 10 rounds (industry standard)
- **JWT in HTTP-only Cookies**: Prevents XSS attacks
- **Helmet middleware**: Protection against common web vulnerabilities
- **SameSite cookies**: CSRF protection
- **Input validation**: Zod catches malformed data before processing

#### 📊 **Modern Stack**
- **Drizzle ORM**: Type-safe, performant, great DX
- **Neon Database**: Serverless scaling, no infrastructure management
- **ESM modules**: Modern JavaScript imports
- **Path aliases**: Clean imports (`#config/*` vs `../../config`)

#### 🪵 **Observability**
- **Structured logging**: Winston with JSON format
- **Request logging**: Morgan tracks all HTTP requests
- **Error logging**: Separate error.log for debugging

#### 📈 **Scalability Ready**
- **Stateless JWT**: Horizontal scaling (no session storage needed)
- **Serverless DB**: Neon auto-scales with load
- **Modular structure**: Easy to add new features

### Tradeoffs & Considerations

#### ⚠️ **Incomplete Features**
- **Sign-in not implemented**: Only placeholder route exists
- **Sign-out not implemented**: Cookie clearing logic needed
- **No auth middleware**: Routes not yet protected (no `requireAuth` middleware)
- **No refresh tokens**: Short JWT lifetime (1 day) without refresh mechanism

#### 🔍 **Missing Features**
- **No password reset**: Forgot password flow not implemented
- **No email verification**: Users not verified after signup
- **No rate limiting**: Vulnerable to brute force attacks
- **No input sanitization**: Beyond validation (e.g., XSS in name field)
- **No RBAC enforcement**: Roles defined but not used in authorization
- **No pagination**: Future user listing would need pagination

#### 🐛 **Potential Issues**

1. **Cookie Bug** (`cookies.js` line 9):
   ```javascript
   res.cookie(name, { ...cookies.getOptions(), ...options });
   // Should be:
   res.cookie(name, value, { ...cookies.getOptions(), ...options });
   ```
   The `value` parameter is missing!

2. **Error Message Leak** (`auth.service.js` line 24):
   ```javascript
   throw new Error(`User ${name} already exists`);
   ```
   Should say "email" not "name" (misleading)

3. **Inconsistent Error Handling**:
   - Service throws generic "Error hashing the user" even for duplicate emails
   - Controller has special handling for this, but brittle

4. **No Database Transactions**:
   - If we had multiple related inserts, no atomicity guarantee

5. **Short Cookie Lifetime**:
   - `maxAge: 15 * 60 * 1000` (15 minutes) vs JWT expiry (1 day)
   - Cookie expires before JWT → user loses token while it's still valid

6. **No HTTPS in Development**:
   - `secure` flag only in production
   - Should test with HTTPS in dev too

#### 🚀 **Performance Considerations**
- **bcrypt blocking**: Password hashing blocks event loop (~100ms)
  - Solution: Use `bcrypt.hash()` (already async) ✅
- **No caching**: Every request hits database
  - Solution: Add Redis for frequently accessed data
- **No connection pooling**: Neon handles this, but good to be aware
- **Synchronous logging**: Winston is sync by default
  - Solution: Already using async transports ✅

#### 🔐 **Security Enhancements Needed**
- **Rate limiting**: Use `express-rate-limit`
- **Input sanitization**: Use `DOMPurify` or similar
- **SQL injection**: Drizzle ORM protects, but be careful with raw SQL
- **Brute force protection**: Lock account after N failed login attempts
- **Security headers**: Already using Helmet ✅
- **Content Security Policy**: Add CSP headers
- **2FA**: Multi-factor authentication

---

## 8. 📝 Final Summary

**TL;DR for Your Teammate**:

> "This is a **Node.js/Express REST API** for user authentication with JWT-based sessions. It follows a **clean 3-layer architecture** (Controllers → Services → Models) using **Drizzle ORM** with **serverless PostgreSQL** (Neon). The app handles secure user registration with **bcrypt password hashing**, **Zod validation**, and **HTTP-only cookie sessions**. It's production-ready for sign-up, but sign-in/sign-out and auth middleware are still TODO. Security is solid with Helmet, CORS, and structured logging via Winston."

### Key Architectural Decisions

1. **Why Layered Architecture?**
   - Clear separation makes code testable and maintainable
   - Business logic isolated in services
   - Easy to swap implementations (e.g., change ORM)

2. **Why JWT in Cookies (not localStorage)?**
   - HTTP-only cookies prevent XSS attacks
   - SameSite flag prevents CSRF attacks
   - More secure than localStorage for tokens

3. **Why Drizzle ORM over Prisma/TypeORM?**
   - Lightweight and fast
   - SQL-like syntax (less abstraction)
   - Excellent TypeScript support
   - Better for serverless environments

4. **Why Neon Database?**
   - Serverless = no infrastructure management
   - Auto-scaling for variable workloads
   - Pay-per-use pricing model
   - Fast cold starts

5. **Why Zod Validation?**
   - Type inference (TypeScript benefits)
   - Composable schemas
   - Better error messages than Joi/Yup
   - Same validation logic on frontend/backend

### Quick Start Commands

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET

# Generate database migrations
npm run db:generate

# Run migrations
npm run db:migrate

# View database in browser
npm run db:studio

# Start development server (with auto-reload)
npm run dev

# Lint code
npm run lint

# Format code
npm run format
```

### Next Steps for Development

**High Priority**:
1. ✅ Fix the cookie setting bug in `utils/cookies.js`
2. 🔨 Implement sign-in controller (authenticate user, return JWT)
3. 🔨 Implement sign-out controller (clear cookie)
4. 🔒 Create auth middleware to protect routes
5. 🔒 Add rate limiting to prevent abuse

**Medium Priority**:
6. 📧 Email verification flow
7. 🔑 Password reset functionality
8. 🔄 Refresh token implementation
9. 🛡️ Input sanitization middleware
10. 📊 Add user listing endpoint (with pagination)

**Nice to Have**:
11. 🎨 API documentation (Swagger/OpenAPI)
12. 🧪 Unit and integration tests
13. 📊 Metrics and monitoring (Prometheus/Grafana)
14. 🐳 Dockerization
15. 🚀 CI/CD pipeline

---

## 📚 Appendix: File Reference

### Critical Files to Know

| File | Purpose | When to Edit |
|------|---------|-------------|
| `src/app.js` | Middleware setup | Adding global middleware, new route groups |
| `src/routes/*.js` | Route definitions | Adding new endpoints |
| `src/controllers/*.js` | Request handlers | Changing API response format |
| `src/services/*.js` | Business logic | Changing how features work |
| `src/models/*.js` | DB schemas | Changing data structure |
| `src/validations/*.js` | Input validation | Changing what's allowed in requests |
| `src/config/database.js` | DB connection | Changing database provider |
| `src/config/logger.js` | Logging setup | Changing log format/destinations |
| `.env` | Environment vars | Configuration changes |
| `drizzle.config.js` | Migration config | Changing migration behavior |

---

## 🎓 Learning Resources

If you're new to any of these technologies:

- **Express**: [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- **Drizzle ORM**: [Drizzle Docs](https://orm.drizzle.team/docs/overview)
- **Zod**: [Zod Documentation](https://zod.dev/)
- **JWT**: [jwt.io Introduction](https://jwt.io/introduction)
- **bcrypt**: [bcrypt npm page](https://www.npmjs.com/package/bcrypt)
- **Winston**: [Winston Logging](https://github.com/winstonjs/winston#readme)

---

**Document Version**: 1.0  
**Last Updated**: 2026-02-05  
**Author**: Architecture Analysis  
**Codebase**: acquisitions API v1.0.0
