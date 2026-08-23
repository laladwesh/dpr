import React from "react";
import { MoonLoader } from "react-spinners";

function Loader({ loading }) {
  if (!loading) return null;

  return (
    <div className="w-full h-screen flex justify-center items-center z-[1000] bg-gray-50">
      <MoonLoader color="#192aac" />
    </div>
  );
}

export default Loader;
