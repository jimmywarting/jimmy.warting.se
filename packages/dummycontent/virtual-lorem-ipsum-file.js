/*! VirtualLoremIpsumFile. MIT License. Jimmy Wärting <https://jimmy.warting.se/opensource> */

class VirtualLoremIpsumFile extends File {
  size = 0

  constructor (size, name, options = {}) {
    super([], name ?? 'virtual.txt', { type: 'text/plain; charset=utf-8', ...options })
    this.size = size
  }

  stream() {
    const encoder = new TextEncoder();
    const lorem = `
      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
      tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
      veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
      commodo consequat. Duis aute irure dolor in reprehenderit in voluptate
      velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint
      occaecat cupidatat non proident, sunt in culpa qui officia deserunt
      mollit anim id est laborum.\n
    `.trimStart().replace(/^[ \t]+|[ \t]+$/gm, '');

    const loremBytes = encoder.encode(lorem);
    let offset = 0;
    const size = this.size;

    return new ReadableStream({
      type: 'bytes',
      pull(controller) {
        if (offset >= size) return controller.close();

        const remaining = size - offset;
        
        // --- LOGIK FÖR ATT STÖDJA BÅDA MODES ---
        if (controller.byobRequest) {
          // BYOB Mode: Använd konsumentens befintliga view
          const view = controller.byobRequest.view;
          const writeSize = Math.min(view.byteLength, remaining);
          
          this._fillBuffer(view, loremBytes, writeSize);
          
          offset += writeSize;
          controller.byobRequest.respond(writeSize);
        } else {
          // Standard Mode: Vi skapar en egen buffer (t.ex. 64KB eller vad som behövs)
          const CHUNK_SIZE = 65536; 
          const writeSize = Math.min(CHUNK_SIZE, remaining);
          const buffer = new Uint8Array(writeSize);
          
          this._fillBuffer(buffer, loremBytes, writeSize);
          
          offset += writeSize;
          controller.enqueue(buffer);
        }
        // ---------------------------------------

        if (offset >= size) controller.close();
      },
      
      // Hjälpmetod för att fylla buffern (för att undvika duplicerad kod)
      _fillBuffer(dest, srcData, totalToWrite) {
        let written = 0;
        while (written < totalToWrite) {
          const toCopy = Math.min(srcData.length, totalToWrite - written);
          dest.set(srcData.subarray(0, toCopy), written);
          written += toCopy;
        }
      }
    });
  }

  async bytes () {
    const out = new Uint8Array(this.size)
    const reader = this.stream().getReader({ mode: 'byob' })
    const result = await reader.read(out, { min: this.size })
    return result.value
  }

  async arrayBuffer () {
    return (await this.bytes()).buffer
  }

  async text () {
    let text = ''
    const decoder = new TextDecoderStream()
    for await (const chunk of this.stream().pipeThrough(decoder)) text += chunk
    return text
  }

  slice (start = 0, end = this.size, type = this.type) {
    start = Math.max(0, start)
    end = Math.min(this.size, end)
    return new VirtualFile({
      size: Math.max(0, end - start),
      type,
      name: this.name,
      lastModified: this.lastModified
    })
  }
}

export {
  VirtualLoremIpsumFile 
}
