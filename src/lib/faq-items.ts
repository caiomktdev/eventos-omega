export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const HOME_FAQ_ITEMS: FaqItem[] = [
  {
    id: "reembolso",
    question: "Como eu cancelo ou peço reembolso de ingressos?",
    answer:
      "O reembolso depende do método de pagamento usado na compra e das regras definidas pelo organizador do evento. Em geral, pedidos de cancelamento devem ser feitos com antecedência mínima informada na página do evento. Entre em contato com o suporte informando o número do pedido (#ordem de compra) para solicitar o reembolso.",
  },
  {
    id: "localizar-ingressos",
    question: "Como localizar meus ingressos?",
    answer:
      "Acesse Meus ingressos no menu do site e informe o e-mail usado na inscrição. Você verá o status do pedido, o número de ordem de compra e, se necessário, o link para concluir o pagamento.",
  },
  {
    id: "titularidade",
    question: "Como trocar a titularidade do ingresso?",
    answer:
      "A troca de titularidade depende das regras de cada evento. Quando permitida, entre em contato com o organizador informando o número do pedido e os dados do novo participante.",
  },
  {
    id: "certificado",
    question: "Como acesso meu certificado?",
    answer:
      "Para eventos que emitem certificado, o documento ficará disponível após a conclusão ou check-in do participante. Entre em contato com o organizador do evento para solicitar o certificado.",
  },
  {
    id: "acesso-conta",
    question: "Não consigo acessar minha conta, o que fazer?",
    answer:
      "Organizadores e administradores acessam pelo login da plataforma. Compradores podem consultar ingressos em Meus ingressos usando o e-mail da inscrição, sem necessidade de senha.",
  },
];
