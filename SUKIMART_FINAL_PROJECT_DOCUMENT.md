# SUKIMART: AN INTEGRATED ONLINE SHOPPING AND DELIVERY MANAGEMENT SYSTEM

**IT PROF EL 4 – Advanced System Integration and Architecture**  
**Final Project Documentation**

**Prepared by:** [Student name/s]  
**Submitted to:** [Instructor's name]  
**Institution:** [Institution name]  
**Date:** [Submission date]

> **Draft for review.** This document is based on the Sukimart project files and the supplied final-project guide. Statements about business conditions and project activities should be confirmed by the proponents. Actual test results, respondent data, dates, and screenshots must be supplied before submission. The architecture diagrams describe the system represented by the source files; deployment and database configuration must also be verified.

## 1. Introduction

Sari-sari stores serve communities by making everyday products accessible. When product inquiries, orders, inventory updates, and delivery coordination are handled through separate conversations or manual records, keeping information consistent can be challenging. These are potential operational concerns; the specific situation of Sukimart's intended store must be validated with its stakeholders.

Sukimart is a web-based shopping and delivery management project designed around customer, administrator, and delivery-driver workflows. Customers can browse products, create orders, and follow order progress. Administrators can manage products, orders, customers, drivers, and reports. Delivery drivers can view assigned orders and coordinate with customers. The application uses Next.js and React for its interface and integrates with Supabase authentication and database services.

This document presents the project's objectives, boundaries, methodology, architecture, and evidence requirements using a modified TOGAF approach. Particular attention is given to data and application architecture, consistent with the examples in the supplied guide.

## 2. Statement of the Problem

The project addresses the general question: **How can Sukimart integrate online ordering, store administration, and delivery coordination in one web-based system?**

Specifically, the project seeks to address the following questions:

1. How can customers access product information, place orders, and monitor their status?
2. How can administrators maintain product and stock information and manage orders and drivers?
3. How can delivery assignments and customer–driver communication be coordinated?
4. How can the system organize and restrict access to customer, product, order, and delivery data?
5. How can the functionality of the integrated system be evaluated using actual test results?

These questions describe the project's intended contribution. Evidence of existing problems and the degree of improvement remains to be collected.

## 3. Scope and Limitations

### 3.1 Scope

The source files describe the following system capabilities, subject to correct configuration:

- Customer account registration, sign-in, password reset, and configured Google sign-in.
- Product browsing, cart, checkout, order status, and notifications.
- Administrator management of products, stock, orders, customers, drivers, store location, and reports.
- Delivery-driver sign-in, assigned-order handling, and profile maintenance.
- Automatic assignment of delivery orders to drivers without an active order.
- Order-specific customer–driver messaging and optional driver location sharing.
- Delivery minimums based on straight-line distance from the configured store location.
- Supabase-based authentication, database functions, and row-level security policies.

### 3.2 Limitations

- The system requires a correctly configured Supabase project and the relevant SQL scripts; the repository alone does not prove a particular deployment is configured or operational.
- Internet and service availability affect the hosted application and its integrated services.
- Driver location sharing is optional, depends on browser permission and a suitable secure context, and requires the driver dashboard to remain open. Location visibility becomes stale after two minutes without an update.
- Driver availability for automatic assignment is based on active orders rather than online presence.
- Distance-based minimums use straight-line distance, not actual road distance. Pickup orders have no delivery minimum.
- The project files do not establish actual user acceptance, transaction volumes, performance improvements, or production readiness.
- The documented status workflow and access policies must be checked against the database migrations applied to the target environment.

## 4. Objectives

### 4.1 General Objective

To develop and document an integrated web-based shopping and delivery management system for Sukimart.

### 4.2 Specific Objectives

1. Provide customer interfaces for account access, product browsing, checkout, and order tracking.
2. Provide administrators with tools for managing products, stock, orders, customers, drivers, and sales-related reports.
3. Support delivery coordination through driver assignments, communication, and optional location sharing.
4. Organize system data and define role-based access using Supabase database policies and functions.
5. Evaluate selected functions through documented tests and report the actual observations.
6. Describe the system's business, data, application, and technology architecture using selected TOGAF-inspired artifacts.

## 5. Methodology

### 5.1 Modified TOGAF Approach

The following is a **project-tailored architecture approach**, not a claim that all formal TOGAF deliverables or governance activities were completed. Confirm completed activities and replace planned items with actual evidence.

| Phase | Application to Sukimart | Proposed evidence |
|---|---|---|
| Preliminary | Establish project boundaries and principles, including usable interfaces and controlled data access. | Scope and principles catalog |
| A: Architecture Vision | Identify customers, administrators, and drivers and define the desired integrated system. | Stakeholder matrix and solution concept |
| B: Business Architecture | Describe ordering, administration, and delivery processes. | Process flow and role descriptions |
| C: Information Systems Architectures | Identify data entities, application components, and their relationships. | Data catalog, matrices, and diagrams |
| D: Technology Architecture | Identify the web framework, database, authentication, and mapping technologies. | Technology catalog and deployment diagram |
| E: Opportunities and Solutions | Group capabilities into customer, administration, and delivery workflows. | Solution components and gaps |
| F: Migration Planning | Plan setup of the database and any migration of existing records, if applicable. | Setup and migration plan |
| G: Implementation Governance | Review implementation against requirements and record test outcomes. | Requirements traceability and test results |
| H: Architecture Change Management | Record issues, approved changes, and future enhancements. | Change log |
| Requirements Management | Maintain requirements and their verification throughout the project. | Requirements catalog |

### 5.2 Proposed Action Plan

The sequence below is a proposed plan. Add actual dates, responsible people, and completion evidence.

| Activity | Output | Responsible person | Actual date/status |
|---|---|---|---|
| Identify stakeholder needs and existing processes | Validated requirements and problem statement | [Name] | [Fill in] |
| Review and document system architecture | Catalogs, matrices, and diagrams | [Name] | [Fill in] |
| Configure application and database | Working test environment | [Name] | [Fill in] |
| Verify customer and administrator functions | Functional test records | [Name] | [Fill in] |
| Verify delivery and integration functions | Delivery test records | [Name] | [Fill in] |
| Gather stakeholder feedback, if conducted | Feedback and findings | [Name] | [Fill in] |
| Prepare final report and code annexes | Submission document | [Name] | [Fill in] |

### 5.3 Architecture Principles Catalog

| Principle | Intended application |
|---|---|
| Data access control | Limit access based on authenticated roles and database policies. |
| Consistent order information | Maintain order status and history in the database. |
| Usability | Provide dedicated interfaces for customer, administrator, and driver activities. |
| Data integrity | Apply database-side checks to important operations, including order workflows. |
| Maintainability | Separate application routes, shared utilities, and database setup scripts. |

### 5.4 Stakeholder Map

| Stakeholder | Interest | Main interaction |
|---|---|---|
| Customer | Browse, order, receive updates, and coordinate delivery | Customer storefront |
| Store administrator | Manage store operations and view reports | Administrator dashboard |
| Delivery driver | Handle assigned orders and communicate with customers | Delivery dashboard |
| Project team | Configure, maintain, and verify the system | Application and database |
| Instructor/evaluator | Assess project requirements and evidence | Documentation and demonstration |

### 5.5 Requirements Catalog and Traceability

| ID | Requirement | Source evidence | Verification |
|---|---|---|---|
| R1 | Customers can access accounts and browse products. | `app/register`, `app/shop` | Register, sign in, and browse; record actual result. |
| R2 | Customers can submit and monitor orders. | `app/shop`, `supabase/setup.sql` | Place an order and observe its status. |
| R3 | Administrators can manage products and orders. | `app/admin/products`, `app/admin/orders` | Update a test product and order. |
| R4 | Delivery orders can be assigned to drivers. | `supabase/automatic-driver-assignment.sql` | Place a delivery order with an idle driver available. |
| R5 | An accepted delivery supports customer–driver messages. | `app/chat/delivery-chat.tsx`, `supabase/delivery-messages.sql` | Exchange messages and test unauthorized access. |
| R6 | Customers can view recent shared driver location during an active delivery. | `app/delivery/location-sharing.tsx`, `app/shop/driver-map.tsx` | Allow GPS and observe the map; test permission denial. |
| R7 | Data access is restricted by applicable policies. | `supabase/setup.sql` and related SQL scripts | Test authorized and unauthorized access using test accounts. |

### 5.6 Business Process Flow

```text
Customer browses products
        ↓
Customer adds products to cart and checks out
        ↓
Order is recorded → Administrator reviews and prepares order
        ↓
Pickup: customer collects order
Delivery: order is assigned when an eligible driver is available
        ↓
Driver accepts → optional location sharing and customer messaging
        ↓
Order status is updated → completion is recorded
```

The exact transitions and who may perform them should be verified against the applied SQL and the running system. The project README describes the general status sequence `new → preparing → on_the_way → completed`, with cancellation permitted while new or preparing.

## 6. TOGAF-Inspired Information Systems Architecture

### 6.1 Solution Concept Diagram

```text
Customer browser ──┐
Admin browser ─────┼──> Sukimart Next.js application ──> Supabase Auth
Driver browser ────┘                │
                                    └──────────────────> Supabase database
                                                         (data, policies, functions)
Driver browser ──> browser GPS permission ──> location data ──> customer map
```

This is a logical view. Actual hosting and network arrangements depend on deployment.

### 6.2 Data Entity / Data Component Catalog

| Data entity or group | Purpose | Logical component | Physical component / evidence |
|---|---|---|---|
| Profile | User identity, role, and contact information | Account management | Supabase database; `supabase/setup.sql` and profile scripts |
| Product | Product details, price, and stock | Catalog management | Supabase database; `supabase/setup.sql` |
| Order and order items | Purchase and product details | Order management | Supabase database; `supabase/setup.sql` |
| Order status history | Record of order status changes | Order tracking | `supabase/admin-dashboard.sql` |
| Notification | Customer-facing order updates | Notifications | `supabase/admin-dashboard.sql` |
| Delivery assignment and location | Driver assignment and shared location | Delivery management | `supabase/delivery.sql`, `supabase/driver-live-location.sql` |
| Delivery message | Communication associated with an order | Delivery communication | `supabase/delivery-messages.sql` |
| Store location | Active store pin used for delivery minimum calculations | Store settings | `supabase/store-location.sql` |

Entity labels are conceptual; consult the SQL scripts for exact table names, columns, and constraints.

### 6.3 Data Entity / Business Function Matrix

**C** = create, **R** = read, **U** = update; entries represent intended function-level usage, not a guarantee of individual permissions.

| Business function | Profile | Product | Order | Status history | Delivery message | Location |
|---|---|---|---|---|---|---|
| Account management | C/R/U | — | — | — | — | — |
| Catalog management | — | C/R/U | — | — | — | — |
| Ordering and tracking | R | R | C/R | R | — | R |
| Order administration | R | R | R/U | C/R | — | R |
| Delivery coordination | R | — | R/U | R | C/R | C/R/U |

### 6.4 Application / Data Matrix

These are logical modules within one application, rather than separate deployed products.

| Application module | Profile | Product | Order and status | Messages | Location |
|---|---|---|---|---|---|
| Customer storefront | R/U | R | C/R | C/R | R |
| Administrator dashboard | R/U | C/R/U | R/U | As applicable | R/U |
| Delivery dashboard | R/U | — | R/U | C/R | C/U |
| Database functions and policies | R | R/U | C/R/U | Enforce access | R/U |

Operations depend on role, ownership, order state, and the policies actually deployed.

### 6.5 Conceptual Data Diagram

```text
Customer profile ── places ──> Order ── contains ──> Order item ── references ──> Product
                                   │
                                   ├── has ──> Status history / notifications
                                   ├── may be assigned to ──> Driver profile
                                   └── may have ──> Delivery messages

Store location ── informs ──> Delivery minimum calculation
Driver location ── supports ──> Active delivery tracking
```

This conceptual diagram does not assert database cardinalities; confirm those in the applied schema.

### 6.6 Data Dissemination and Security

```text
Customer ── order and account data ──> Application ──> Supabase database
Administrator ── product/order changes ──> Application ──> Supabase database
Assigned driver ── status/messages/location ──> Application ──> Supabase database
Customer <── authorized order updates/messages/recent location ── Application
```

| Actor | Intended access | Important restriction |
|---|---|---|
| Customer | Own profile and orders; available products; eligible order communication | Access to private order data should be restricted to the relevant customer. |
| Administrator | Store management and administrative views | Administrative access requires an authorized admin role. |
| Driver | Assigned deliveries and own profile | Delivery messages are limited to the relevant customer and assigned driver. |
| Server administration scripts | Privileged account management | Service-role secrets must remain server-side and must not be included in the document. |

The matrix describes intended access; verify each rule with the deployed policies and negative tests. Do not include real credentials, secret keys, or personal data in the submitted annexes.

### 6.7 Data Lifecycle and Migration

**Order lifecycle:** order created → prepared → delivery or pickup processing → completed or, where allowed, cancelled → retained according to the store's policy. The repository does not establish a formal retention or deletion policy; this must be confirmed.

**Migration:** No completed migration from a previous store system is established by the available files. If migration is needed, document the source, authorized data, field mapping, validation, backup, and reconciliation results. Do not claim migration occurred without evidence.

### 6.8 Role / Application and Application / Function Matrices

| Logical application module | Customer | Administrator | Delivery driver |
|---|---|---|---|
| Customer storefront | Yes | Not primary | Not primary |
| Administrator dashboard | No | Yes | No |
| Delivery dashboard | No | Manages drivers and assignments | Yes |

| Logical application module | Browse and order | Product/stock management | Order management | Delivery coordination | Reports |
|---|---|---|---|---|---|
| Customer storefront | Yes | — | Track own order | Messages/tracking | — |
| Administrator dashboard | — | Yes | Yes | Driver management | Yes |
| Delivery dashboard | — | — | Assigned orders | Yes | — |

### 6.9 Technology Architecture

| Component | Technology / purpose |
|---|---|
| Web application | Next.js, React, TypeScript |
| Styling and interface | Tailwind CSS, CSS modules, Lucide React |
| Authentication and data | Supabase Auth and PostgreSQL-backed Supabase database |
| Mapping | Leaflet and browser location APIs |
| Development tools | Node.js, npm, ESLint |

Package versions and configuration are available in `my-app/package.json`. The actual host, database region, and deployment setup should be added only after confirmation.

## 7. Results and Discussion

### 7.1 Evidence Available from the Project

The project contains application routes, components, and SQL scripts for the workflows described above. This is **source-code evidence of intended implementation**, not proof that all features passed testing or were deployed. No actual participant responses, test execution records, sales records, or measured performance data were supplied for this report.

### 7.2 Actual Test Results — To Be Completed

Use a safe test environment and test accounts. Record the real date, observed output, and pass/fail status; attach screenshots where appropriate.

| Test | Expected outcome | Actual observation / evidence | Result | Date |
|---|---|---|---|---|
| Customer sign-in | A valid customer can access the storefront. | [Enter actual result] | [Pass/Fail] | [Date] |
| Order checkout | A valid order is recorded and visible to the customer. | [Enter actual result] | [Pass/Fail] | [Date] |
| Product management | An administrator can update a test product. | [Enter actual result] | [Pass/Fail] | [Date] |
| Order status | An authorized status change is reflected in tracking and history. | [Enter actual result] | [Pass/Fail] | [Date] |
| Driver assignment | An eligible idle driver receives a delivery assignment. | [Enter actual result] | [Pass/Fail] | [Date] |
| Driver messaging | The customer and assigned driver can exchange messages after acceptance. | [Enter actual result] | [Pass/Fail] | [Date] |
| Unauthorized access | Another user cannot read a private order or delivery message. | [Enter actual result] | [Pass/Fail] | [Date] |
| Driver location | Recent location is visible after permission is granted. | [Enter actual result] | [Pass/Fail] | [Date] |
| Delivery minimum | Checkout enforces the relevant distance-based threshold. | [Enter actual result] | [Pass/Fail] | [Date] |

**Summary:** [Insert the actual number of tests executed, passed and failed, and discuss unresolved issues. Do not calculate or claim improvement without supporting measurements.]

### 7.3 Stakeholder Evaluation

If an evaluation was conducted, add the actual methodology, number and roles of participants, dates, instrument, results, and limitations here. Otherwise, state that user evaluation has not yet been conducted. Remove or anonymize personally identifiable information.

## 8. Conclusion and Recommendations

The Sukimart project brings together shopping, store management, and delivery coordination in a single web application architecture. The available source files describe interfaces, supporting database scripts, and integrations for these workflows. Their effectiveness and readiness for real-world use remain subject to configuration, functional testing, security verification, and stakeholder evaluation.

Recommended next steps are to complete and document end-to-end tests, verify role and data access policies, confirm all required migrations are applied, gather stakeholder feedback, and establish backup, retention, and operational procedures. Any future enhancements should be based on validated needs and recorded as proposed work.

## References

1. IT PROF EL 4, *Advanced System Integration and Architecture Final Project Requirements*, supplied project guide.
2. The Open Group, *TOGAF Version 9.1: Sample Catalogs, Matrices and Diagrams*, referenced in the project guide: http://www.togaf.info/togafSlides91/TOGAF-V91-Sample-Catalogs-Matrics-Diagrams-v3.pdf.
3. Sukimart project source files and `my-app/README.md`.

## Annexes

### Annex A. Selected Source Code

Include selected, relevant excerpts with file names and brief explanations. The following source files are suitable starting points:

| Topic | Project file |
|---|---|
| Customer storefront and ordering | `my-app/app/shop/customer-shop.tsx` |
| Administrator order management | `my-app/app/admin/orders-manager.tsx` |
| Driver dashboard | `my-app/app/delivery/dashboard.tsx` |
| Database tables and order placement | `my-app/supabase/setup.sql` |
| Status workflow and notifications | `my-app/supabase/admin-dashboard.sql` |
| Automatic driver assignment | `my-app/supabase/automatic-driver-assignment.sql` |
| Delivery messaging | `my-app/supabase/delivery-messages.sql` |
| Delivery minimums and store location | `my-app/supabase/store-location.sql` |

Insert excerpts required by the instructor; this file list is not a substitute for the actual code annex. Exclude `.env.local`, passwords, service-role keys, and real customer information.

### Annex B. Screenshots and Testing Evidence

Insert dated, anonymized screenshots of the customer storefront, checkout, admin dashboard, driver dashboard, order tracking, and test outcomes. Label each image and explain what it demonstrates.

### Annex C. Project Information to Complete

- Official project title and team members.
- Instructor, institution, and submission date.
- Actual store context and validated statement of the problem.
- Dates, assigned responsibilities, and completed action-plan activities.
- Actual deployment details and applied database scripts.
- Actual test records, results, screenshots, and stakeholder feedback.
- Relevant code excerpts and any instructor-required formatting.
