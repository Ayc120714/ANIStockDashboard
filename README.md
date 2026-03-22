# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Docker (full stack)

Docker files live **next to this repo** so they do not affect normal `npm` / backend workflows:

**`../stockdashboard-docker/`** (under `ANIStockProject`)

From that folder run `docker compose build && docker compose up -d`, then open **http://localhost**. See **`stockdashboard-docker/README.md`** in that folder for logs, backups, and env vars.

## Local dev (React + FastAPI + PostgreSQL + Cursor)

Step-by-step (Postgres, env vars, `uvicorn`, `npm start`, and using Cursor’s terminal for API calls): **[docs/deployment/local-fullstack-cursor-setup.md](docs/deployment/local-fullstack-cursor-setup.md)**. Quick start: `npm run dev:fullstack` (requires Postgres + backend `.env`). The API must live in **`../backend_stockdashboard`** (sibling of this folder), not inside `stockdashboard/`.

## Linux VPS (production-style stack)

Enable the same components on an Ubuntu VPS (systemd, Nginx, Let’s Encrypt): **[docs/deployment/vps-linux-fullstack-setup.md](docs/deployment/vps-linux-fullstack-setup.md)**.

**Install & run for production domain `aycindustries.com`:** **[docs/deployment/VPS_INSTALL_RUN_AYCINDUSTRIES.md](docs/deployment/VPS_INSTALL_RUN_AYCINDUSTRIES.md)** (DNS, bootstrap script, SSL, checks).

**Hostinger API vs SSH to the VPS:** **[docs/deployment/hostinger-api-and-vps-access.md](docs/deployment/hostinger-api-and-vps-access.md)**.

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
