import { Image } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Card({
  number,
  description,
  price,
}: {
  number: number;
  description: string;
  price: string;
}) {
  const Navigate = useNavigate();

  return (
    <div
      onClick={() =>
        Navigate(`./product/${number}/${encodeURIComponent(description)}`)
      }
      className="w-30 h-fit bg-gray-900 rounded-2xl overflow-hidden border border-gray-700 shadow-2xl hover:cursor-pointer hover:scale-105 transition-all duration-300"
    >
      <div className="h-[80%] bg-blue-900 flex items-center justify-center p-8">
        <Image />
      </div>
      <div className="h-[20%] px-3 flex flex-col items-start capitalize">
        <h1>product {number}</h1>
        <h2>${price}</h2>
      </div>
    </div>
  );
}
