class Wompi {
    /**
     * Crea una instancia de LinkGenerator.
     * @param {string} url - La URL base para la clase.
     * @param {string} key - La clave para la clase.
     */
    constructor(url, key) {
        this.url = url;
        this.key = key;
    }

    /**
     * Devuelve un enlace que combina la URL y la clave.
     * @returns {object} El enlace completo.
     */
    async getLink(title, description, id, price) {
        try {
            const response = await fetch(`${this.url}/payment_links`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.key}`
                },
                body: JSON.stringify({
                    "name": title,
                    "description": description,
                    "single_use": true,
                    "collect_shipping": false,
                    "currency": "COP",
                    "amount_in_cents": price * 100,
                    "sku": id
                })
            });

            const data = await response.json();

            if (response.ok) {
                // La solicitud fue exitosa (código de estado 200-299)
                return { success: true, data: { id: data.data.id, link: `https://checkout.wompi.co/l/${data.data.id}` } };
            } else {
                // La solicitud falló
                throw new Error(data.message || 'Error en la solicitud a Wompi');
            }
        } catch (error) {
            // Maneja errores de red o cualquier otro error
            return { success: false, message: error.message };
        }
    }
}

module.exports = Wompi;