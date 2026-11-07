# Relay — Frontend Operations Console & Customer Support Portal

[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg?logo=react&logoColor=black)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Vitest](https://img.shields.io/badge/Vitest-28%20Tests%20Passing-brightgreen.svg)]()
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com)

> **Live Deployments:**  
> 🌐 **Operations Console (Admin Panel):** [https://relay-frontend-s78n.onrender.com/](https://relay-frontend-s78n.onrender.com/)  
> 💬 **Customer Support Portal (User Panel):** [https://relay-frontend-s78n.onrender.com/support](https://relay-frontend-s78n.onrender.com/support)  
> ⚡ **Backend Repository:** [https://github.com/avhii01/back](https://github.com/avhii01/back)

---

## 📌 Problem Statement

Customer operations teams face two major frontend challenges:
1. **Operator Fragmentation:** Operators lack unified visibility into why an automated recovery failed, which microservices timed out, or what evidence was collected, leading to high MTTR (Mean Time to Resolution).
2. **Customer Impatience & Hallucinatory Chatbots:** Customers need instant self-service, but generative AI chatbots often make unfounded promises without verified policy grounding or real-time order ownership checks.

---

## 💡 The Solution: Dual-Persona Web Experience

Relay provides two distinct, tailored interfaces built with **React 18**, **TypeScript (Strict Mode)**, and **Vite**:

### 1. Operations Console (`/`)
* **Live Order Reconciliation Queue:** Real-time visibility into stuck e-commerce orders, categorized by failure modes (`SHIPPING_DELAY`, `PAYMENT_PENDING`, `OUT_OF_STOCK`).
* **Visual Tool Timeline & Evidence Inspector:** Displays step-by-step agent tool calls, microservice payloads, and deterministic policy decisions.
* **Microservice Health Topology:** Live status cards for Stripe payments, warehouse inventory, and shipping carrier dispatch.
* **Role-Based Security & Ticket Locking:**
  * Once a ticket is assigned to a specialist, reassignment is locked to **Administrators only**.
  * Team passwords are strictly hidden and redacted for non-admin operators.
  * Clean unauthenticated header: search bar, apps launcher, and sign-out buttons are suppressed until authenticated.

### 2. Customer Support Portal (`/support`)
* **Grounded Policy Q&A:** Answers grounded in verified policy documents with clickable section citations.
* **Order History & Issue Intake:** Allows customers to select past orders and submit verified failure claims.
* **Confirmation-First Dispatch:** Issues are submitted to background recovery workers only after explicit customer confirmation.

---

## 🔐 Authentication, Access & Privacy

* **Operator Authentication:** Administrators and support specialists log in via the Operations sign-in view. Session tokens are checked server-side and role boundaries are strictly enforced.
* **Credential Protection:** Team member passwords in the roster view are strictly restricted to administrators; non-admin operators see all password tags completely hidden.
* **Customer Self-Service:** Customers authenticate via `/support` or can register new customer accounts directly on the portal. Orders are verified server-side against the authenticated session token.
* **Zero Credential Exposure:** In accordance with security standards, plaintext passwords are not published in public documentation.

---

## 🚀 Local Development

```bash
# 1. Install dependencies
npm install

# 2. Run development server (Vite)
npm run dev
```
The application will run locally at: `http://localhost:5173`

### Available NPM Scripts:
| Script | Description |
| :--- | :--- |
| `npm run dev` | Starts local Vite hot-reloading development server |
| `npm run build` | Runs TypeScript typecheck (`tsc --noEmit`) and Vite production bundle |
| `npm test` | Runs the automated Vitest test suite |
| `npm run preview` | Locally serves the built production `dist/` directory |

---

## 🧪 Automated Testing

Relay Frontend features **28 passing Vitest tests** covering components, security guards, and user flows:
```bash
npm test -- --run
```
Test coverage includes:
* Status chips, tone mappings, and metrics strips
* Approval panel human-in-the-loop validation
* Support ticket workspace and conversation viewer
* Unauthenticated header hygiene (search bar & sign-out hiding)
* Role-based password visibility in the settings modal

---

## 🐳 Docker Deployment

The frontend includes a multi-stage Docker build utilizing **Node 22 (Alpine)** for building and **Nginx 1.27 (Alpine)** for production static asset serving:

```bash
docker build --build-arg VITE_API_URL=https://backend-pvco.onrender.com -t relay-frontend .
docker run -p 80:80 relay-frontend
```

---

## 📄 License
MIT License
