# KUDO KUDO - Smart Attendance Management System

A modern, mobile-optimized attendance management system built with React, Tailwind CSS, and Firebase.

## Features

- **Face Recognition**: Secure attendance tracking using face-api.js.
- **Geofencing**: Ensures attendance is only recorded within the specified work location.
- **Role-Based Access Control**: Different views and permissions for Employees, Managers, and Admins.
- **Payroll Management**: Automated salary calculations, bonuses, deductions, and financial reports.
- **Real-time Notifications**: Instant alerts for salary updates, attendance events, and requests.
- **Dynamic Scheduling**: Weekly work schedules and group-based management.
- **Mobile Optimized**: 100% responsive design with PWA support.

## Deployment to GitHub Pages

To deploy this project to GitHub Pages and avoid the "white screen" error:

### Option 1: GitHub Actions (Recommended)
1. Push your code to GitHub.
2. Go to **Settings > Pages**.
3. Under **Build and deployment > Source**, select **GitHub Actions**.
4. GitHub will automatically detect the Vite project and use a workflow to build and deploy it.

### Option 2: Manual Deployment
If you are deploying manually (e.g., using the `gh-pages` branch):
1. Run `npm run build`.
2. Ensure you are deploying the contents of the **`dist`** folder, NOT the root folder.
3. Ensure the `.nojekyll` file (included in this repo) is present in your deployment to prevent GitHub from ignoring assets.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS 4.
- **Animations**: Framer Motion.
- **Database & Auth**: Firebase Firestore & Firebase Authentication.
- **Export**: jsPDF, SheetJS (XLSX).

## Getting Started

1. Clone the repository.
2. Install dependencies: `npm install`.
3. Set up your Firebase project and add your configuration to `src/firebase-applet-config.json` (based on `.env.example`).
4. Run development server: `npm run dev`.
5. Build for production: `npm run build`.

## License

Private
