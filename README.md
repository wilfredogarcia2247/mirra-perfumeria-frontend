# Welcome to your Lovable project

## Project info

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/b855e838-83d4-4a67-aff3-d987da4b2640) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/b855e838-83d4-4a67-aff3-d987da4b2640) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Configuración de variables de entorno

Este proyecto utiliza variables de entorno prefijadas con `VITE_` (usadas por Vite). Para ayudar al equipo, hay un archivo de ejemplo llamado `.env.example` en la raíz del repositorio.

Pasos rápidos:

```bash
# Copiar el ejemplo a tu .env local
cp .env.example .env

# Edita .env con tus valores (por ejemplo: URL del backend, credenciales de Supabase, Cloudinary, etc.)
```

Notas:
- No subas tu archivo `.env` al repositorio. El `.gitignore` ya contiene `.env` y `.env.*`.
- Las variables encontradas en el proyecto son:
- Las variables encontradas en el proyecto son:
	- `VITE_API_URL` (URL base del API)
	- `VITE_CLOUDINARY_CLOUD_NAME`
	- `VITE_CLOUDINARY_UPLOAD_PRESET`

Si necesitas ayuda para obtener las credenciales de Cloudinary u otros servicios, dime y te guío.
