
const handleError = (error, req, res, next) => {
    const status = error.status || 500;
    const isDev = process.env.NODE_ENV !== 'production';

    let message = error.message || 'Error interno del servidor';
    let errorContent = null;

    // Determina el contenido del error
    if (isDev) {
        if (error.errorContent instanceof Error) {
            errorContent = {
                message: error.errorContent.message,
                stack: error.errorContent.stack,
            };
        } else if (typeof error.errorContent === 'string') {
            errorContent = { message: error.errorContent };
        } else if (error.errorContent) {
            errorContent = error.errorContent;
        } else if (error.stack) {
            errorContent = { stack: error.stack };
        }
    }

    // Registro en consola (solo en desarrollo)
    if (isDev) {
        console.error('🔴 Error capturado por middleware:', {
            status,
            message,
            path: req.originalUrl,
            method: req.method,
            time: new Date().toISOString(),
            ...(errorContent && { errorContent }),
        });
    }

    // Respuesta al cliente
    return res.status(status).json({
        status,
        message,
        ...(errorContent && { error: errorContent }),
    });
};

module.exports = handleError;
