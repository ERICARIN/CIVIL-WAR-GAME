// js/pre_render.js

/**
 * Pre-renders all static entities within a single chunk to its own canvas.
 * This canvas is then stored in chunk.staticCache.
 * @param {object} chunk - The chunk object to pre-render.
 */
function preRenderChunk(chunk) {
    // console.log(`preRenderChunk: Starting pre-render for chunk ${chunk.key} in region ${chunk.rx}_${chunk.ry}`);
    
    const chunkCanvas = document.createElement('canvas');
    const chunkSizePx = CHUNK_SIZE * TILE_SIZE;
    chunkCanvas.width = chunkSizePx;
    chunkCanvas.height = chunkSizePx;
    const ctx = chunkCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Draw randomized grass subtiles for the chunk
    if (grassSubTiles && grassSubTiles.length === 4) {
        // Calculate world coordinates for the current chunk's top-left tile
        const worldTileStartX = Math.floor(chunk.x / TILE_SIZE);
        const worldTileStartY = Math.floor(chunk.y / TILE_SIZE);

        for (let ty = 0; ty < CHUNK_SIZE; ty++) {
            for (let tx = 0; tx < CHUNK_SIZE; tx++) {
                // Calculate absolute world tile coordinates
                const absoluteWorldTileX = worldTileStartX + tx;
                const absoluteWorldTileY = worldTileStartY + ty;

                // Create a deterministic seed string based on world tile coordinates
                const seedString = `${absoluteWorldTileX},${absoluteWorldTileY}`;
                
                // Get the initial large integer seed directly from the hash function
                const tileSeed = cyrb53(seedString);
                
                // Use modulo directly on the seed to get a random index (0, 1, 2, or 3)
                // This relies on the distribution quality of cyrb53 over sequential tile coordinates
                const randomIndex = (tileSeed % 4 + 4) % 4; // Ensure result is non-negative
                
                ctx.drawImage(grassSubTiles[randomIndex], tx * TILE_SIZE, ty * TILE_SIZE);
            }
        }
    }
    
    ctx.translate(-chunk.x, -chunk.y); // MOVED THIS LINE HERE

    const chunkViewBounds = {
        minX: chunk.x,
        maxX: chunk.x + chunkSizePx,
        minY: chunk.y,
        maxY: chunk.y + chunkSizePx,
    };

    // To fix autotiling at chunk edges, we need to consider shapes from neighboring chunks.
    const neighbors = getNeighboringChunks(chunk);
    const allRelevantEntities = [...chunk.staticEntities];
    for (const neighbor of neighbors) {
        allRelevantEntities.push(...neighbor.staticEntities);
    }

    const paths = allRelevantEntities.filter(e => e.type === 'path');
    const buildings = allRelevantEntities.filter(e => ['house', 'shop', 'kabak'].includes(e.type));

    drawAutotiledLayer(ctx, paths, dirtTexture, chunkViewBounds);
    drawAutotiledLayer(ctx, buildings, desksTexture, chunkViewBounds);
    
    chunk.staticCache = chunkCanvas;
}
