1. nuevo cliente, pasa su ubicación en el mapa, la app va a buscar en un radio de 1km (10 cuadras de 100 mts) los repartos que están más cerca y se los va a ofrecer

2. cómo cargas los pedidos (lo que se le entrega al cliente semana a semana en water service), una nota? ticket

2.1. en caso de que sea por notas, qué te parece esta? Qué formato usan?

```
titulo: "Visita por alta — {nombre}"
nota:   "Producto: 2x Bidón 20L, 1x Soda"
        "Horario: entre 11 y 17"
        "Monto a cobrar: $X"
```
a verificar (por licha con repartidor):
```
Título: 
Cliente nuevo

Mensaje: 
Cliente nuevo de frío calor, cobrar X cantidad.
productos que compró
Pasar entre X y X hora
```

3. tienen promociones para la gente nueva que ingresa?

frío calor implica un abono mensual fijo que sería 34 mil x mes (lista 1), 38 mil x mes (lista 2), 1er mes 50% de descuento.
incluye 4 botellones de 20L

natural es gratis se paga por botellón.

4. tienen algún producto estrella que les mejore el margen? como para sugerirlo más que el resto o que aparezca primero. Sí, botelón de 20 L

5. queda poco claro cuáles son los productos disponibles en cada zona
precios:
- default general
- lobos precio distinto (menores en gral)
- si (dispenser frío calor) AND (zárate, campana ó escobar) entonces precio especial (un poco más alto bidones)

todas las zonas tienen los mismos productos

únicos productos displonibles:
- BOTELLON 12L
- BOTELLON 20L
- BOTELLON 12L NA
- BOTELLON 20L NA
- SIFON 1 1/2L	(retornables)
- AGUA SABORIZADA 1.5 L
- GASEOSAS 2 L
- AGUA 2L
- CIMES PLUS ISOTONICA 750 ml (tipo powerade)

Precios, en zárate, campana y escobar, con frío calor el precio sube. En el de 20 y 20 na

los únicos precios importnates son (matriz de precios de water service):
- LISTA PRECIOS GENERAL
- PRECIO LOBOS
- PRECIO CAMPANA ESPECIAL (frío calor, aplica a zárate, campana y escobar)

rotación de precios: cada 3 meses aprox

6. están bien las zonas? falta alguna?


por resolver (yo)
- cómo se cargan los nuevos clientes a la app de water service
- cómo cargas la orden en Water Service?

- es peligroso que si una persona se da de alta con un teléfono ya registrado este pise al anterior

cosas rotas: 

todo: cards social media

se confirma el alta por el crm, no se carga en water service de 1

Prompts for claude:

First:

-
add the Escobar button

-
add change mini title from the home page to "Pureza bien protegida"

-
So for the displayed numbers at step 3 from the flow the Escobar number apperas as
+54 9 034 8___-____
when it should be:
+54 9 0348 ___-____
please add this to the reggex without affecting the other number logic

-
rework products and their copy on the home page

### Undone

-
Rework of the Otra ciudad flow

-
Add an adition step between the current 1 and 2 where they choose between cold/hot water via Comodato, they have a promotion of 50% off the first month
Options:
- Dispenser Natural (Gratis)
- Dispenser Frío/Calor (50% Off)
- Sin Dispenser

reference you can go to 
https://aguaivess.rosmino.com.ar/alta-automatica/
and on Dirección put `Av. Triunvirato 4355` and choose the first one of the list. Click `Siguiente`. After that you'll get the following element we need to copy:
<div class="grid grid-cols-1 md:grid-cols-2 gap-6"><div class="flex flex-col items-center gap-3 rounded-lg shadow-md border-ivess-gray-light border px-6 pt-6 transition-all duration-300 hover:cursor-pointer bg-white"><div class="flex items-center w-full gap-3"><span class="text-xl font-semibold">Natural</span><div class="inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary hover:bg-primary/80 text-xs text-ivess-green">GRATIS</div></div><p class="text-sm text-ivess-gray-dark">Obtené <span class="font-bold">sin cargo</span> el dispenser (entregado en comodato) y empezá a disfrutar agua de calidad a temperatura ambiente.</p><div class="flex items-center w-full gap-6 mt-auto"><img src="/alta-automatica/assets/dispenser-natural-BPIfc4aE.jpg" alt="Dispenser Natural" class="h-48"><p class="text-sm text-ivess-gray-dark"><span class="font-semibold">Medidas</span><br>Alto 80cm<br>Ancho 40cm<br>Profundidad 40cm</p></div></div><div class="flex flex-col items-center gap-3 rounded-lg shadow-md border-ivess-gray-light border px-6 pt-6 transition-all duration-300 hover:cursor-pointer bg-white"><div class="flex items-center w-full gap-3"><span class="text-xl font-semibold">Frío-Calor</span><div class="inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-primary hover:bg-primary/80 text-xs text-ivess-green">GRATIS</div></div><p class="text-sm text-ivess-gray-dark">Obtené <span class="font-bold">sin cargo</span> el dispenser (entregado en comodato) con la <span class="font-bold">compra mínima de un botellón por semana</span> y elegí la temperatura que necesites.<br>¡Mantenimiento y servicio técnico sin cargo!</p><div class="flex items-center w-full gap-6 mt-auto"><img src="/alta-automatica/assets/dispenser-hot-cold-BTz_zviA.jpg" alt="Dispenser Frío-Calor" class="h-48"><p class="text-sm text-ivess-gray-dark"><span class="font-semibold">Medidas</span><br>Alto 130cm (incluye botellón de 12lts.)<br>Ancho 40cm<br>Profundidad 40cm</p></div></div><div class="flex flex-col md:flex-row md:items-center gap-6 md:col-span-2 rounded-lg shadow-md border-ivess-gray-light border transition-all duration-300 hover:cursor-pointer bg-white"><div class="p-6 space-y-1"><span class="text-xl font-semibold">Me interesan otros productos</span><p class="text-sm">No necesito de un dispenser, quiero otros productos.</p></div><img src="/alta-automatica/assets/other-products-CNE4Wb2f.jpg" alt="Otros productos" class="w-48 ml-auto pr-6 pt-3"></div></div>

also here's a picture.

Note: Usuer should click any to move forward, clicking none should promt user to clicking any

-
rework price table/logic

-
rework the neightbours first.

-
Bug: on step where the user picks time and hour from the visit, the user is offered the same one regardless the zone they selected

-
Bug: Finishing the registration flow does not create a new