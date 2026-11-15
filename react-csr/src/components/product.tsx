import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MoveLeft } from "lucide-react";

interface ProductData {
  id: number;
  title: string;
  description: string;
  price: number;
  thumbnail: string;
}

async function fetchProduct(
  id: string,
  signal: AbortSignal,
  retries = 3,
): Promise<ProductData> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`https://dummyjson.com/products/${id}`, {
        signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (signal.aborted) throw err;
      if (attempt === retries - 1) throw err;
      console.warn("retry", attempt + 1);
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  throw new Error("Failed to load product");
}

export default function Product() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<ProductData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    setProduct(null);
    setError(null);

    fetchProduct(id, controller.signal)
      .then(setProduct)
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Something went wrong");
      });

    return () => controller.abort();
  }, [id, reloadKey]);

  useEffect(() => {
    if (product) {
      performance.mark("products-visible");
    }
  }, [product]);

  if (error) {
    return (
      <div className="text-white h-screen w-full bg-gray-900 p-5 flex flex-col items-start gap-3">
        <Link to="/" className="flex items-center gap-2">
          <MoveLeft />
          <p>back to products</p>
        </Link>
        <p>Failed to load product ({error}).</p>
        <button
          className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500"
          onClick={() => setReloadKey((k) => k + 1)}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!product) {
    return <div className="h-screen w-full bg-gray-900" />;
  }

  return (
    <div className="text-white h-screen w-full bg-gray-900 p-5 flex flex-col gap-3">
      <div className="flex w-full">
        <Link to="/" className="flex items-center gap-2">
          <MoveLeft />
          <p>back to products</p>
        </Link>
      </div>
      <div className="h-full flex flex-col gap-2 overflow-hidden">
        <div className="flex items-center justify-center bg-blue-800 w-full rounded-3xl h-1/2">
          <img
            src={product.thumbnail}
            alt={product.title}
            className="w-full h-full object-contain"
          />
        </div>
        <div className="w-full flex flex-row gap-2 justify-center items-center">
          <span className="w-5 h-5 rounded-full bg-red-500"></span>
          <span className="w-5 h-5 rounded-full bg-white"></span>
          <span className="w-5 h-5 rounded-full bg-white"></span>
        </div>
        <div className="flex items-center justify-between w-full">
          <h3 className="capitalize font-medium text-lg">{product.title}</h3>
          <h3 className="text-red-300 text-lg">${product.price}</h3>
        </div>
        <div className="border-t border-b border-white py-3 px-5 rounded-2xl">
          <p className="text-sm font-light text-justify">
            {product.description}
          </p>
        </div>
      </div>
    </div>
  );
}
