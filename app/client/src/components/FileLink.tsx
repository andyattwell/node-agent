import jsonIcon from "../assets/icons/json.svg";
import mdIcon from "../assets/icons/md.svg";
import txtIcon from "../assets/icons/txt.svg";

const getFileName = (path: string) => {
  return path?.split("/").pop() ?? path;
};

const getFileIcon = (extension: string) => {
  switch (extension) {
    case "md":
      return mdIcon;
    case "txt":
      return txtIcon;
    case "json":
      return jsonIcon;
    case "log":
      return txtIcon;
  }
};

export default function FileLink({
  path,
  handleOpenFile,
  className,
}: {
  path: string;
  handleOpenFile: (path: string) => void;
  className?: string;
}) {
  if (!path) {
    return <div>{getFileName(path)}</div>;
  }
  // console.log("state", state);
  const extension = path?.split(".").pop()?.toLowerCase() ?? "";
  const defaultLinkClass =
    "mx-1 my-2 block h-20 w-[70px] rounded-lg border border-white/10 text-center no-underline bg-white/[0.06] text-[#93c5fd] transition-colors hover:border-white/20 hover:bg-white/[0.1] hover:text-[#bfdbfe]";
  return (
    <a
      href="#"
      className={className ?? defaultLinkClass}
      onClick={(e) => {
        e.preventDefault();
        handleOpenFile(path);
      }}
      rel="noopener noreferrer"
      target="_blank"
    >
      <span className="inline-block h-[50px] w-[60px] rounded-md bg-white/10">
        <img src={getFileIcon(extension)} alt={extension} />
      </span>
      <span className="block w-full break-all bg-black/30 p-0.5 text-[0.8rem] text-white/70">
        {getFileName(path)}
      </span>
    </a>
  );
}
