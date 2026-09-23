import { redirect } from "next/navigation";
/** «Связи» merged into «Настройки»: the plain «Откуда данные» block lives there. */
export default function Page() { redirect("/settings#sources"); }
