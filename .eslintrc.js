module.exports = {
  env: {
    browser: false,
    es2021: true,
  },
  extends: ["airbnb-base"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
  },
  plugins: ["@typescript-eslint"],
  rules: {
    // aws-lambda の CloudFormation におけるカスタムリソースまわりの型名は
    // 名前が長くて型定義が長くなりがちになるので、 airbnb の max-len が
    // おせっかいになることがおおいため無効化する
    "max-len": "off",
    // workspace と、 lambda のコード管理の噛み合わせがわるく、
    // Lambda 関数のコード内のみだけで利用する型を持つモジュールを
    // Lambda 関数内で import すると丁寧に指摘してくるがおせっかいなため無効化
    "import/no-unresolved": "off",
    // CDK では構成を定義できればいいだけの場合(つまり、定義されたリソースの設定値を
    // 他で必要とされないようなリソースを定義する場合)は `new` してインスタンスを
    // 生成するが、それを変数に束縛して利用しないというときがあるが、 airbnb スタイルは
    // これを指摘してくるが、これはおせっかいのため無効化
    "no-new": "off",
    // Lambda 関数のコード内では aws-sdk ライブラリの型情報を利用して aws-sdk の
    // 中身を呼び出すコードを書いているが、
    // 他方、 Lambda の runtime には既に aws-sdk が組込み済みのため、
    // aws-sdk は devDependencies 扱いとしておくのが適当。
    // このとき、 eslint 的にはライブラリをコード中で呼び出しているのだから、
    // aws-sdk は devDepnendencies ではなく dependencies とすべきということで、
    // `import/no-extraneous-dependencies` を理由として違反だと指摘してくるが、
    // 既に述べたように Lambda ランタイムには組込み済みでこの指摘は単なる
    // eslint のおせっかいなので無視させる。
    // ref: https://docs.aws.amazon.com/ja_jp/lambda/latest/dg/lambda-runtimes.html
    "import/no-extraneous-dependencies": "off",
    // カスタムリソースのライフサイクルをフックしている Lambda 関数のみで
    // switch を使うが、この中で全イベントを特定しているため、
    "default-case": "off",
    // handler しか export しない Lambda 関数コードで default export にしろと迫ってくるが、
    // これ以外は Lambda 関数で export したものを利用しないため、無視させる
    "import/prefer-default-export": "off",
  },
};
