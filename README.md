# Splitzy Pay 

*A simple and scalable payments and expense sharing app

Splitzy Pay is a full-stack expense sharing platform designed to simplify group expenses, settlements, and balance tracking.
The project follows a **clean monorepo structure** with clearly separated **frontend**, **backend**, and **database** layers, making it easy to develop, test, and deploy independently.

---

## Project Structure

Please follow this folder structure to keep things simple.

```
splitzy-pay/
│
├── backend/
│   ├── app/                # Flask application code
│   ├── migrations/         # Database migrations
│   ├── requirements.txt    # Backend dependencies
│   ├── run.py              # Entry point for backend server
│   └── README.md           # Backend-specific documentation
│
├── frontend/
│   ├── src/
│   │   ├── pages/          # Application pages/views
│   │   ├── ux_elements/    # Reusable UI components
│   │   ├── services/
│   │   │   └── api.js      # API service layer
│   │   └── App.jsx         # Root React component
│   ├── public/             # Static assets
│   ├── package.json        # Frontend dependencies & scripts
│   └── README.md           # Frontend-specific documentation
│
├── database/
│   ├── schema.sql          # Database schema definition
│   ├── seed.sql            # Initial seed data
│   ├── queries.sql         # Common SQL queries
│   └── README.md           # Database documentation
│
├── docs/
│   ├── ER_Diagram.png      # Entity Relationship Diagram
│   ├── API_Docs.md         # API documentation
│   ├── Report.pdf          # Final project report
│   └── Screenshots/        # UI screenshots
│
├── .env.example            # Environment variable template
├── .gitignore
└── README.md               # Project overview (this file)
```

---

## Tech Stack

### Frontend

* React (Vite)
* HTML, CSS, JavaScript
* API communication via Axios / Fetch

### Backend

* Python (Flask)
* RESTful API architecture
* SQLAlchemy & Flask-Migrate

### Database

* PostgreSQL
* Structured SQL schemas and queries

### Deployment (Planned)

* Frontend: Vercel
* Backend & Database: Render

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/splitzy-pay.git
cd splitzy-pay
```

### 2. Environment Variables

Create a `.env` file using `.env.example` as reference and fill in the required values.

---

## ▶️ Running the Project

### Backend

```bash
cd backend
pip install -r requirements.txt
python run.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Database

* Create a PostgreSQL database
* Run `schema.sql` to initialize tables
* Optionally run `seed.sql` for sample data

---

## Documentation

All project documentation is available in the `docs/` folder:

* **ER Diagram** – Database design
* **API Docs** – Endpoint specifications
* **Report** – Detailed DBMS project report
* **Screenshots** – UI walkthrough


---


* Each major folder (`frontend`, `backend`, `database`) contains its own `README.md` for detailed instructions.
* Keep commits small and meaningful.
* Do **not** commit `.env` files.

---
