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

    ctx.translate(-chunk.x, -chunk.y);

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
