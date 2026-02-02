# API Documentation

## Base URL

- Development: `http://localhost:5000/api`
- Production: TBD

---

## Authentication Endpoints

### Health Check

```http
GET /api/health
```

**Response:**

```json
{ "status": "ok", "timestamp": "2024-01-01T00:00:00.000Z" }
```

---

### Register User

```http
POST /api/auth/register
```

**Headers:**

```
Authorization: Bearer <firebase_id_token>
Content-Type: application/json
```

**Body:**

```json
{
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "username": "johndoe",
  "branch": "gil-puyat"
}
```

**Response (201):**

```json
{
  "message": "User registered successfully",
  "user": {
    "_id": "...",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "branch": "gil-puyat",
    "role": "tenant"
  }
}
```

---

### Login

```http
POST /api/auth/login
```

**Headers:**

```
Authorization: Bearer <firebase_id_token>
```

**Response (200):**

```json
{
  "message": "Login successful",
  "user": { ... },
  "token": "jwt_token"
}
```

---

### Get Profile

```http
GET /api/auth/profile
```

**Headers:**

```
Authorization: Bearer <jwt_token>
```

**Response (200):**

```json
{
  "user": {
    "_id": "...",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "branch": "gil-puyat",
    "role": "tenant"
  }
}
```

---

### Update Branch

```http
PATCH /api/auth/update-branch
```

**Headers:**

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Body:**

```json
{
  "branch": "gil-puyat"
}
```

**Response (200):**

```json
{
  "message": "Branch updated successfully",
  "user": { ... }
}
```

---

## Room Endpoints

### Get All Rooms

```http
GET /api/rooms
```

**Query Parameters:**

- `branch`: Filter by branch (`gil-puyat` | `guadalupe`)
- `type`: Filter by room type
- `available`: Filter by availability (`true` | `false`)

**Response (200):**

```json
{
  "rooms": [
    {
      "_id": "...",
      "name": "Room 101",
      "type": "private",
      "branch": "gil-puyat",
      "price": 8000,
      "capacity": 1,
      "available": true
    }
  ]
}
```

---

### Get Room by ID

```http
GET /api/rooms/:id
```

**Response (200):**

```json
{
  "room": { ... }
}
```

---

## Reservation Endpoints

### Get All Reservations (Admin)

```http
GET /api/reservations
```

**Headers:**

```
Authorization: Bearer <admin_jwt_token>
```

**Query Parameters:**

- `branch`: Filter by branch
- `status`: Filter by status (`pending` | `confirmed` | `cancelled`)

---

### Create Reservation

```http
POST /api/reservations
```

**Headers:**

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Body:**

```json
{
  "roomId": "room_id",
  "checkIn": "2024-02-01",
  "checkOut": "2024-02-28",
  "notes": "Optional notes"
}
```

---

### Update Reservation Status (Admin)

```http
PATCH /api/reservations/:id/status
```

**Body:**

```json
{
  "status": "confirmed"
}
```

---

## Inquiry Endpoints

### Create Inquiry (Public)

```http
POST /api/inquiries
```

**Body:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "09123456789",
  "subject": "Room Availability",
  "message": "I would like to inquire about...",
  "branch": "gil-puyat"
}
```

---

### Get All Inquiries (Admin)

```http
GET /api/inquiries
```

**Headers:**

```
Authorization: Bearer <admin_jwt_token>
```

---

### Respond to Inquiry (Admin)

```http
PATCH /api/inquiries/:id/respond
```

**Body:**

```json
{
  "response": "Thank you for your inquiry..."
}
```

_Note: This also sends an email to the customer_

---

## User Management (Super Admin)

### Get All Users

```http
GET /api/users
```

**Headers:**

```
Authorization: Bearer <super_admin_jwt_token>
```

---

### Update User Role

```http
PATCH /api/users/:id/role
```

**Body:**

```json
{
  "role": "admin"
}
```

---

## Error Responses

### 400 Bad Request

```json
{
  "error": "Validation error message"
}
```

### 401 Unauthorized

```json
{
  "error": "No token provided" | "Invalid token"
}
```

### 403 Forbidden

```json
{
  "error": "Access denied"
}
```

### 404 Not Found

```json
{
  "error": "Resource not found"
}
```

### 500 Internal Server Error

```json
{
  "error": "Internal server error"
}
```
