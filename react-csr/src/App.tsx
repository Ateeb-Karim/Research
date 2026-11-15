import { useEffect, useState } from "react";
import Card from "./component/card";

interface Product {
  id: number;
  description: string;
  price: number;
}

function App() {
  const [data, setData] = useState<{ products: Product[] }>({ products: [] });

  useEffect(() => {
    const fetchingData = async () => {
      const fetchedData = await fetch(
        "https://dummyjson.com/products?limit=30",
      ).then((res) => res.json());
      setData(fetchedData);
    };
    fetchingData();
  }, []);

  return (
    <div className="text-white h-screen w-full bg-gray-900 p-5 flex flex-col gap-3 overflow-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium">product store</h1>
        <h3 className="text-xl">30 items</h3>
      </div>
      <div className="grid grid-cols-5 gap-3">
        {data.products.slice(0, 30).map((product: Product, index: number) => (
          <Card
            key={product.id}
            number={index + 1}
            description={product.description}
            price={product.price.toString()}
          />
        ))}
      </div>
    </div>
  );
}

export default App;
