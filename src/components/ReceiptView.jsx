import React from 'react';
import { useTheme } from '../context/ThemeContext';

const fmt = v => ((Number(v) || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

const getFullAddress = (client) => {
  if (!client) return 'N/A';
  const parts = [];
  const street = client.endereco || client.logradouro;
  if (street) parts.push(street);
  if (client.numero) parts.push(client.numero);
  if (client.bairro) parts.push(client.bairro);
  if (client.cep) parts.push(`CEP: ${client.cep}`);
  const city = client.cidade || client.cidadeUf;
  if (city) {
    if (client.uf) {
      parts.push(`${city}/${client.uf}`);
    } else {
      parts.push(city);
    }
  } else if (client.uf) {
    parts.push(client.uf);
  }
  return parts.length > 0 ? parts.join(', ') : 'N/A';
};

const ReceiptView = ({ sale, company, isPrinting = false }) => {
  const { t, currentTheme } = useTheme();
  if (!sale || !company) return null;

  const isPending = sale.status === 'pendente';

  const [logoBase64, setLogoBase64] = React.useState('');
  const [barcodeBase64, setBarcodeBase64] = React.useState('');
  const [qrBase64, setQrBase64] = React.useState('');

  React.useEffect(() => {
    const toBase64 = async (url) => {
      if (!url) return '';
      if (url.startsWith('data:')) return url;
      try {
        const proxyUrl = `http://localhost:5000/api/proxy?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error(`Proxy returned status ${res.status}`);
        const blob = await res.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.warn("Base64 fetch via proxy failed, trying direct fetch fallback:", url, e);
        try {
          const res = await fetch(url);
          const blob = await res.blob();
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        } catch (fallbackErr) {
          console.warn("Direct fetch fallback failed too:", url, fallbackErr);
          return '';
        }
      }
    };

    if (company.logoUrl) {
      toBase64(company.logoUrl).then(base64 => base64 && setLogoBase64(base64));
    }
    
    const barcodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${(sale.id || '').substring(0, 8).toUpperCase()}&scale=1.8&height=5`;
    toBase64(barcodeUrl).then(base64 => base64 && setBarcodeBase64(base64));

    if (sale.nfce) {
      const qrUrl = sale.nfce.storageQrUrl || (sale.nfce.qrcodeUrl?.startsWith('http') ? sale.nfce.qrcodeUrl : `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(sale.nfce.qrcodeUrl || '')}`);
      toBase64(qrUrl).then(base64 => base64 && setQrBase64(base64));
    }
  }, [company.logoUrl, sale.id, sale.nfce]);

  // Tax calculation logic (Approximate values for fiscal transparency)
  const rateFed = 0.1345; // 13.45%
  const rateEst = 0.1200; // 12.00%
  const rateMun = 0.0200; // 2.00%
  const totalTaxRate = rateFed + rateEst + rateMun;

  const totalTaxes = sale.total * totalTaxRate;

  const containerStyle = {
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: '8.4px',
    fontWeight: 'bold',
    color: '#000000',
    width: '96mm',
    padding: '10px 5mm',
    backgroundColor: '#fdf6e2', // Yellowish thermal receipt paper color
    margin: '0 auto',
    boxSizing: 'border-box',
    lineHeight: '1.15',
    WebkitPrintColorAdjust: 'exact',
    WebkitFontSmoothing: 'none',
    MozOsxFontSmoothing: 'unset',
    fontSmooth: 'never'
  };

  const isDelivery = sale.type === 'entrega';
  const isPickup = sale.type === 'retirada';

  return (
    <div style={containerStyle} className="receipt-container">
      <style>{`
        .receipt-container * {
          font-weight: bold !important;
        }
        @media print {
          .receipt-container {
            width: 80mm !important;
            padding: 10px 5mm !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 7px !important;
            line-height: 1.15 !important;
            font-weight: bold !important;
            -webkit-font-smoothing: none !important;
            font-smooth: never !important;
            background-color: white !important;
            color: black !important;
          }
          .receipt-container * {
            color: black !important;
            border-color: black !important;
            font-weight: bold !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
      {/* Logo & Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px', borderBottom: '1px dashed #000', paddingBottom: '4px', gap: '10px' }}>
        {company.logoUrl && (
          <img
            src={logoBase64 || company.logoUrl}
            style={{ width: '48px', height: '48px', objectFit: 'contain', filter: 'grayscale(1) contrast(2)', flexShrink: 0 }}
            alt="Logo Left"
          />
        )}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontWeight: 600, textTransform: 'uppercase', lineHeight: '1.2' }}>{company.nomeFantasia || company.nome || 'NOME DA EMPRESA'}</div>
          <div>CNPJ: {company.cnpj || '00.000.000/0000-00'}</div>
          <div>IE: {company.ie || '0000000000'}</div>
          <div>{company.logradouro || 'Rua'}, {company.numero || '000'} - {company.bairro || ''}</div>
          <div>{company.cidade || 'Cidade'}/{company.estado || 'UF'}</div>
          {company.telefone && <div style={{ fontWeight: 600 }}>TEL: {company.telefone}</div>}
        </div>
        {company.logoUrl && (
          <img
            src={logoBase64 || company.logoUrl}
            style={{ width: '48px', height: '48px', objectFit: 'contain', filter: 'grayscale(1) contrast(2)', flexShrink: 0 }}
            alt="Logo Right"
          />
        )}
      </div>

      <div style={{ textAlign: 'center', fontWeight: 600, marginBottom: '4px' }}>
        {isPending ? 'COMPROVANTE DE PEDIDO (NÃO FISCAL)' : 'DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRÔNICA'}
        <div style={{ borderBottom: '1px dashed #000', paddingBottom: '2px', marginBottom: '4px' }}></div>
        {new Date(sale.createdAt).toLocaleString('pt-BR')} - OPERADOR: {String(sale.operadorNome || sale.operator || 'SISTEMA').trim().split(' ')[0].toUpperCase()}<br />
        PEDIDO: {sale.id?.substring(0, 8).toUpperCase() || '---'} - {(sale.type || 'venda').toUpperCase()}<br />

        {isPending && (
          <div style={{ backgroundColor: '#000', color: '#fff', padding: '4px', marginTop: '4px' }}>
            AGUARDANDO PAGAMENTO
          </div>
        )}

        <div style={{ margin: '4px auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img
            src={barcodeBase64 || `https://bwipjs-api.metafloor.com/?bcid=code128&text=${(sale.id || '').substring(0, 8).toUpperCase()}&scale=1.8&height=5`}
            style={{ maxWidth: '100%', height: '18px', objectFit: 'contain', filter: 'grayscale(1) contrast(2)' }}
            alt="Barcode"
          />
        </div>
      </div>

      {/* Items */}
      <div style={{ borderBottom: '1px dashed #000', paddingBottom: '2px', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
        <span>ITEM | DESCRIÇÃO</span>
        <span>VALOR (R$)</span>
      </div>

      <div style={{ marginBottom: '4px' }}>
        {sale.items?.map((i, idx) => (
          <div key={idx} style={{ marginBottom: '5px' }}>
            <div>{String(idx + 1).padStart(3, '0')} {i.nome?.toUpperCase()} {i.isGift && '(BRINDE)'}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{i.quantity} {i.unidade || 'UN'} x {fmt(i.price)}</span>
              <span>{fmt(i.price * i.quantity)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div style={{ borderTop: '1px dashed #000', paddingTop: '3px', marginBottom: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
          <span>SUBTOTAL:</span>
          <span>R$ {fmt(sale.items?.reduce((a, x) => a + (x.price * x.quantity), 0))}</span>
        </div>
        {((Number(sale.promoDiscount) || 0) > 0) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
            <span>DESC. PROMOÇÃO:</span>
            <span>- R$ {fmt(sale.promoDiscount)}</span>
          </div>
        )}
        {((Number(sale.discount) || 0) > 0) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
            <span>OUTROS DESCONTOS:</span>
            <span>- R$ {fmt(sale.discount)}</span>
          </div>
        )}
        {((Number(sale.shipping) || 0) > 0) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
            <span>FRETE / TAXAS:</span>
            <span>+ R$ {fmt(sale.shipping)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginTop: '2px', paddingTop: '2px', borderTop: '1px solid #000' }}>
          <span>TOTAL A PAGAR:</span>
          <span>R$ {fmt(sale.total)}</span>
        </div>
      </div>

      {/* Payment Info */}
      <div style={{ marginBottom: '4px' }}>
        <div style={{ fontWeight: 600, marginBottom: '3px' }}>FORMA DE PAGAMENTO:</div>
        {(sale.payments || []).map((p, idx) => (
          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ textTransform: 'uppercase' }}>{p.method?.replace(/_/g, ' ')}</span>
            <span>R$ {fmt(p.value)}</span>
          </div>
        ))}
        {(() => {
          const totalPaid = sale.payments?.reduce((acc, p) => acc + (p.value || 0), 0) || 0;
          const change = Math.max(0, totalPaid - sale.total);
          const hasCash = sale.payments?.some(p =>
            p.method?.toLowerCase().includes('dinheiro') ||
            p.methodId === 'dinheiro'
          );

          if (hasCash || change > 0) {
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginTop: '2px', borderTop: '1px dashed #000', paddingTop: '2px' }}>
                <span>TROCO:</span>
                <span>R$ {fmt(change)}</span>
              </div>
            );
          }
          return null;
        })()}
      </div>

      {/* Fiscal / Non-Fiscal Section */}
      {(sale.nfce) ? (
        <div style={{ borderTop: '1px dashed #000', marginTop: '4px', paddingTop: '4px' }}>
          {/* QR Code + Dados Fiscais */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            {sale.nfce.status !== 'contingencia_offline' && (
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <img
                  src={qrBase64 || sale.nfce.storageQrUrl || (sale.nfce.qrcodeUrl?.startsWith('http') ? sale.nfce.qrcodeUrl : `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(sale.nfce.qrcodeUrl || '')}`)}
                  style={{ width: '77px', height: '77px' }}
                  alt="QR Code NFC-e"
                />
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, marginBottom: '4px', textTransform: 'uppercase' }}>
                {sale.nfce.status === 'autorizado' ? 'NFC-e AUTORIZADA' : 
                 sale.nfce.status === 'processando_autorizacao' ? 'NFC-e EM PROCESSAMENTO' : 
                 sale.nfce.status === 'contingencia_offline' ? 'NFC-e EMITIDA EM CONTINGÊNCIA' :
                 `NFC-e: ${(sale.nfce.status || 'PENDENTE').toUpperCase()}`}
              </div>
              
              {sale.nfce.status === 'contingencia_offline' && (
                <div style={{ fontWeight: 800, backgroundColor: '#000', color: '#fff', padding: '3px', textAlign: 'center', marginBottom: '4px' }}>
                  NÃO ENVIADA PARA SEFAZ · PENDENTE DE TRANSMISSÃO
                </div>
              )}

              <div style={{ fontWeight: 600, marginBottom: '4px' }}>{sale.client?.cpf ? `CPF: ${sale.client.cpf}` : 'CONSUMIDOR NÃO IDENTIFICADO'}</div>

              {(sale.nfce.numero || sale.nfce.serie) ? (
                <div style={{ fontWeight: 600, marginBottom: '2px' }}>
                  {sale.nfce.numero && `NFC-e Nº ${sale.nfce.numero}`}
                  {sale.nfce.serie && ` - SÉRIE ${sale.nfce.serie}`}
                </div>
              ) : (
                sale.nfce.status === 'contingencia_offline' && (
                  <div style={{ fontWeight: 600, marginBottom: '2px', fontStyle: 'italic' }}>
                    Nº E SÉRIE SERÃO ATRIBUÍDOS ONLINE
                  </div>
                )
              )}

              {sale.nfce.protocolo && (
                <div style={{ fontWeight: 600, marginBottom: '2px' }}>
                  PROTOCOLO: {sale.nfce.protocolo}
                </div>
              )}

              <div style={{ fontWeight: 600 }}>EMISSÃO: {new Date(sale.createdAt).toLocaleString('pt-BR')}</div>
            </div>
          </div>

          {/* Consulta Block */}
          {sale.nfce.status !== 'contingencia_offline' ? (
            <a
              href={sale.nfce.urlConsulta}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'block',
                textAlign: 'center',
                border: '1px solid #000',
                padding: '4px',
                marginTop: '3px',
                textDecoration: 'none',
                color: '#000'
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '2px' }}>CONSULTE PELA CHAVE DE ACESSO EM:</div>
              <div style={{ wordBreak: 'break-all', marginBottom: '2px' }}>
                {sale.nfce.urlConsulta?.replace(/^https?:\/\//, '') || 'www.nfce.fazenda.gov.br/portal'}
              </div>
              <div style={{ letterSpacing: '-0.1px', wordBreak: 'break-all', textAlign: 'center' }}>
                {sale.nfce.chave?.replace(/^NFe/, '').replace(/(.{4})/g, '$1 ')}
              </div>
            </a>
          ) : (
            <div
              style={{
                textAlign: 'center',
                border: '1px dashed #000',
                padding: '5px',
                marginTop: '3px'
              }}
            >
              <div style={{ fontWeight: 800 }}>VIA DO CONSUMIDOR</div>
              <div>EMISSÃO EM CONTINGÊNCIA DEVIDO A INDISPONIBILIDADE DE CONEXÃO.</div>
              <div>SERÁ TRANSMITIDA E DISPONIBILIZADA ONLINE EM ATÉ 24H.</div>
            </div>
          )}
        </div>

      ) : !isPending ? (
        null
      ) : (
        <div style={{ borderTop: '1px dashed #000', marginTop: '10px', paddingTop: '10px', textAlign: 'center', fontWeight: 600 }}>
          Este documento não é fiscal e não substitui a NFC-e.<br />
          A nota fiscal será emitida após a confirmação do pagamento.
        </div>
      )}

      {/* Delivery / Pickup */}
      {(isDelivery || isPickup) && (
        <div style={{ marginTop: '4px', borderTop: '1px dashed #000', paddingTop: '4px' }}>
          <div style={{ fontWeight: 600, textAlign: 'center' }}>DADOS PARA {(sale.type || 'VENDA').toUpperCase()}</div>
          <div>CLIENTE: {String(sale.client?.nome || 'N/A').toUpperCase()}</div>
          <div>TEL: {String(sale.client?.telefone || 'N/A').toUpperCase()}</div>
          {isDelivery && <div>ENDEREÇO: {getFullAddress(sale.client).toUpperCase()}</div>}
          <div style={{ marginTop: '2px', textAlign: 'center', fontWeight: 600 }}>OBSERVAÇÃO</div>
          <div style={{ textAlign: 'center' }}>{sale.paymentPolicy?.replace(/_/g, ' ').toUpperCase() || '---'}</div>
        </div>
      )}

      {/* Tax Breakdown */}
      {!isPending && (
        <div style={{ marginTop: '4px', borderTop: '1px dashed #000', paddingTop: '3px', textAlign: 'center', letterSpacing: '-0.1px', lineHeight: '1.2' }}>
          Valor Aproximado dos Tributos (Lei 12.741/2012):<br />
          Federais: R$ {fmt(sale.total * rateFed)} | Estaduais: R$ {fmt(sale.total * rateEst)} | Mun: R$ {fmt(sale.total * rateMun)}<br />
          Total: R$ {fmt(totalTaxes)} ({(totalTaxRate * 100).toFixed(2)}%) | Fonte: IBPT
        </div>
      )}

      <div style={{ marginTop: '8px', textAlign: 'center', borderTop: '1px dashed #000', paddingTop: '3px', fontWeight: 600 }}>
        Obrigado pela preferência!
      </div>
    </div>
  );
};

export default ReceiptView;
