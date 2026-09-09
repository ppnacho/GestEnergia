# ⚡ Gestor Energético

Plataforma web moderna y centralizada para la monitorización, control y gestión de datos energéticos (**agua, luz y gas**), con almacenamiento seguro de facturas y un panel de administración protegido para datos sensibles.

---

## 🚀 Características Principales

- **Dashboard Visual:** Interfaz moderna, limpia y responsive construida con Tailwind CSS y efectos visuales de alta calidad.
- **Gestión de Suministros:** Apartado dedicado (`suministros.html`) para el acceso a las compañias de suministro energetico.
- **Acceso Protegido (`gestenergetica.html`):** Panel privado restringido para la gestión de datos sensibles y administración del sistema.
- **Almacenamiento de Facturas:** Repositorio digital integrado para la subida y consulta de facturas energéticas.
- **Backend / Base de Datos:** Conexión directa con **Supabase** para la persistencia de datos y autenticación segura.

---

## 📂 Estructura del Proyecto

```text
├── index.html            # Página de inicio / Landing principal
├── index.js              # Lógica JavaScript para la página de inicio
├── suministros/suministros.html      # Vista de gestión de suministros energéticos
├── gestion/gestenergetica.html   # Panel protegido de datos sensibles (requiere auth)
├── .gitignore            # Archivos y carpetas excluidos del control de versiones
└── README.md             # Documentación del proyecto
