

create sequence orders_order_number_seq start 150500001;

alter table orders add column order_number bigint;

with ordered as (
  select id, row_number() over (order by created_at) as rn
  from orders
)
update orders o
set order_number = 150500000 + ordered.rn
from ordered
where o.id = ordered.id;

select setval('orders_order_number_seq', coalesce((select max(order_number) from orders), 150500000));

alter table orders alter column order_number set default nextval('orders_order_number_seq');
alter table orders alter column order_number set not null;
alter table orders add constraint orders_order_number_unique unique (order_number);
create index orders_order_number_idx on orders (order_number);
