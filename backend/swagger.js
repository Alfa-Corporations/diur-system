
const swaggerJSDOC = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const baseUrl = process.env.HOST || `http://localhost:${process.env.PORT || 1811}`;
const apiBaseUrl = `${baseUrl}/api/v1`;

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "DIUR System API",
            version: "1.0.0",
            description: "Documentación de endpoints del sistema DIUR para autenticación, productos, facturas y sincronización."
        },
        servers: [
            {
                url: apiBaseUrl,
                description: "Servidor actual"
            }
        ],
        tags: [
            { name: "Auth", description: "Autenticación y perfil" },
            { name: "Users", description: "Gestión de usuarios" },
            { name: "Products", description: "Inventario y productos" },
            { name: "Invoices", description: "Facturación" },
            { name: "Sync", description: "Sincronización offline/online" }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT"
                }
            },
            schemas: {
                LoginRequest: {
                    type: "object",
                    required: ["identifier", "password"],
                    properties: {
                        identifier: { type: "string", example: "admin@diur.com" },
                        password: { type: "string", example: "admin123" }
                    }
                },
                RegisterRequest: {
                    type: "object",
                    required: ["username", "email", "password"],
                    properties: {
                        username: { type: "string", example: "nuevo.usuario" },
                        email: { type: "string", format: "email", example: "nuevo@diur.com" },
                        password: { type: "string", example: "clave123" },
                        role: { type: "string", enum: ["admin", "cashier", "warehouse", "delivery"], example: "cashier" }
                    }
                },
                ProductRequest: {
                    type: "object",
                    required: ["name", "price", "stock", "sku"],
                    properties: {
                        name: { type: "string", example: "Laptop Lenovo" },
                        description: { type: "string", example: "Laptop Ryzen 7" },
                        price: { type: "number", example: 850 },
                        stock: { type: "integer", example: 12 },
                        category: { type: "string", example: "Tecnología" },
                        sku: { type: "string", example: "LAP-001" }
                    }
                },
                InvoiceRequest: {
                    type: "object",
                    required: ["items"],
                    properties: {
                        documentType: { type: "string", enum: ["consumer_final", "sales_note", "sri_invoice"], example: "sales_note" },
                        customerName: { type: "string", example: "Cliente mostrador" },
                        customerEmail: { type: "string", format: "email", example: "cliente@correo.com" },
                        customer: {
                            type: "object",
                            properties: {
                                name: { type: "string", example: "Juan Pérez" },
                                email: { type: "string", format: "email", example: "juan@correo.com" },
                                phone: { type: "string", example: "0999999999" },
                                identificationType: { type: "string", enum: ["none", "cedula", "ruc", "passport"], example: "cedula" },
                                identificationNumber: { type: "string", example: "0912345678" },
                                address: { type: "string", example: "Guayaquil - Ecuador" }
                            }
                        },
                        items: {
                            type: "array",
                            items: {
                                type: "object",
                                required: ["productId", "quantity"],
                                properties: {
                                    productId: { type: "integer", example: 1 },
                                    quantity: { type: "integer", example: 2 }
                                }
                            }
                        }
                    }
                },
                InvoiceStatusRequest: {
                    type: "object",
                    required: ["status"],
                    properties: {
                        status: { type: "string", enum: ["pending", "paid", "cancelled"], example: "paid" },
                        paymentMethod: { type: "string", enum: ["cash", "card", "check", "transfer", "other"], example: "cash" },
                        paymentReference: { type: "string", example: "REC-4455" },
                        amountReceived: { type: "number", example: 100 },
                        changeAmount: { type: "number", example: 10 }
                    }
                }
            }
        },
        paths: {
            "/auth/register": {
                post: {
                    tags: ["Auth"],
                    summary: "Registrar usuario público",
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/RegisterRequest" }
                            }
                        }
                    },
                    responses: {
                        201: { description: "Usuario registrado" },
                        400: { description: "Datos inválidos" }
                    }
                }
            },
            "/auth/login": {
                post: {
                    tags: ["Auth"],
                    summary: "Iniciar sesión",
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/LoginRequest" }
                            }
                        }
                    },
                    responses: {
                        200: { description: "Login exitoso" },
                        401: { description: "Credenciales inválidas" }
                    }
                }
            },
            "/auth/profile": {
                get: {
                    tags: ["Auth"],
                    summary: "Obtener perfil actual",
                    security: [{ bearerAuth: [] }],
                    responses: {
                        200: { description: "Perfil del usuario" },
                        401: { description: "Token inválido o ausente" }
                    }
                }
            },
            "/auth/logout": {
                post: {
                    tags: ["Auth"],
                    summary: "Cerrar sesión",
                    security: [{ bearerAuth: [] }],
                    responses: {
                        200: { description: "Logout exitoso" }
                    }
                }
            },
            "/users": {
                post: {
                    tags: ["Users"],
                    summary: "Crear usuario desde admin",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/RegisterRequest" }
                            }
                        }
                    },
                    responses: {
                        201: { description: "Usuario creado" },
                        403: { description: "Solo admin" }
                    }
                }
            },
            "/products": {
                get: {
                    tags: ["Products"],
                    summary: "Listar productos",
                    security: [{ bearerAuth: [] }],
                    responses: {
                        200: { description: "Listado de productos" }
                    }
                },
                post: {
                    tags: ["Products"],
                    summary: "Crear producto",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ProductRequest" }
                            }
                        }
                    },
                    responses: {
                        201: { description: "Producto creado" },
                        403: { description: "Sin permisos" }
                    }
                }
            },
            "/products/{id}": {
                get: {
                    tags: ["Products"],
                    summary: "Obtener producto por ID",
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
                    responses: {
                        200: { description: "Producto encontrado" },
                        404: { description: "No encontrado" }
                    }
                },
                put: {
                    tags: ["Products"],
                    summary: "Actualizar producto",
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ProductRequest" }
                            }
                        }
                    },
                    responses: {
                        200: { description: "Producto actualizado" }
                    }
                },
                delete: {
                    tags: ["Products"],
                    summary: "Eliminar producto",
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
                    responses: {
                        200: { description: "Producto eliminado" }
                    }
                }
            },
            "/products/{id}/stock": {
                patch: {
                    tags: ["Products"],
                    summary: "Actualizar stock",
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        quantity: { type: "integer", example: 5 }
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        200: { description: "Stock actualizado" }
                    }
                }
            },
            "/invoices": {
                get: {
                    tags: ["Invoices"],
                    summary: "Listar facturas",
                    security: [{ bearerAuth: [] }],
                    responses: {
                        200: { description: "Listado de facturas" }
                    }
                },
                post: {
                    tags: ["Invoices"],
                    summary: "Crear factura",
                    security: [{ bearerAuth: [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/InvoiceRequest" }
                            }
                        }
                    },
                    responses: {
                        201: { description: "Factura creada" }
                    }
                }
            },
            "/invoices/{id}": {
                get: {
                    tags: ["Invoices"],
                    summary: "Obtener factura por ID",
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
                    responses: {
                        200: { description: "Factura encontrada" },
                        404: { description: "No encontrada" }
                    }
                }
            },
            "/invoices/{id}/status": {
                patch: {
                    tags: ["Invoices"],
                    summary: "Actualizar estado de factura",
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/InvoiceStatusRequest" }
                            }
                        }
                    },
                    responses: {
                        200: { description: "Estado actualizado" }
                    }
                }
            },
            "/invoices/{id}/send-email": {
                post: {
                    tags: ["Invoices"],
                    summary: "Enviar nota de venta por correo",
                    description: "Envía al correo del cliente una nota de venta con formato inspirado en el SRI, sin validación electrónica.",
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
                    requestBody: {
                        required: false,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        email: { type: "string", format: "email", example: "cliente@correo.com" }
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        200: { description: "Correo enviado correctamente" }
                    }
                }
            },
            "/invoices/{id}/cancel": {
                post: {
                    tags: ["Invoices"],
                    summary: "Cancelar factura",
                    security: [{ bearerAuth: [] }],
                    parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
                    responses: {
                        200: { description: "Factura cancelada" }
                    }
                }
            },
            "/sync/pending": {
                get: {
                    tags: ["Sync"],
                    summary: "Ver eventos pendientes",
                    security: [{ bearerAuth: [] }],
                    responses: {
                        200: { description: "Eventos pendientes" }
                    }
                }
            },
            "/sync/events": {
                post: {
                    tags: ["Sync"],
                    summary: "Sincronizar eventos",
                    security: [{ bearerAuth: [] }],
                    responses: {
                        200: { description: "Sincronización completada" }
                    }
                }
            },
            "/sync/cleanup": {
                post: {
                    tags: ["Sync"],
                    summary: "Limpiar eventos sincronizados",
                    security: [{ bearerAuth: [] }],
                    responses: {
                        200: { description: "Limpieza completada" }
                    }
                }
            }
        }
    },
    apis: ["./src/routes/*.js", "./src/controllers/*.js", "./src/models/*.js"]
};

const swaggerSpec = swaggerJSDOC(options);

const swaggerDocs = app => {
    app.use("/api/v1/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        explorer: true
    }));

    app.get("/api/v1/docs.json", (req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.send(swaggerSpec);
    });

    console.log(`Documentation available in ${baseUrl}/api/v1/docs`);
};

module.exports = swaggerDocs;
