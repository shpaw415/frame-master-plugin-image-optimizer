import ImageTest from "../../assets/img/logo.png";

export default function HomePage() {
  return (
    <div>
      <img src={ImageTest.src(320, "webp")} />
    </div>
  );
}
