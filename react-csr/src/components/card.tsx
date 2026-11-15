import { Link } from "react-router-dom";

export default function Card({
  id,
  image,
  title,
  price,
}: {
  id: number;
  image: string;
  title: string;
  price: number;
}) {
  return (
    <Link
      to={`/product/${id}`}
      className="flex flex-col gap-2 rounded-2xl bg-blue-800 p-3"
    >
      <img
        src={image}
        alt={title}
        width={240}
        height={240}
        className="rounded-lg"
      />
      <div className="flex items-center justify-between">
        <h3 className="capitalize font-medium text-sm">{title}</h3>
        <h3 className="text-red-300 text-sm">${price}</h3>
      </div>
    </Link>
  );
}
